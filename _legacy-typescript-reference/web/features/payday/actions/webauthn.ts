'use server';

import {
    generateRegistrationOptions,
    verifyRegistrationResponse,
    generateAuthenticationOptions,
    verifyAuthenticationResponse,
} from '@simplewebauthn/server';
import type {
    GenerateRegistrationOptionsOpts,
    VerifyRegistrationResponseOpts,
    GenerateAuthenticationOptionsOpts,
    VerifyAuthenticationResponseOpts,
} from '@simplewebauthn/server';
import { headers } from 'next/headers';
import { prisma } from '@core/database/prisma-singleton';
import { rpName, rpID as defaultRpID, origin as defaultOrigin } from '../lib/webauthn-config';
import { revalidatePath } from 'next/cache';

// Helper to get dynamic RP ID and Origin
async function getDynamicConfig() {
    const headersList = await headers();
    const host = headersList.get('host') || 'localhost:3000';
    const proto = headersList.get('x-forwarded-proto') || (host.includes('localhost') ? 'http' : 'https');

    // RP ID is hostname without port
    const rpID = host.split(':')[0];
    const origin = `${proto}://${host}`;

    return { rpID, origin };
}

// Re-export RP ID for frontend
export const getRpID = async () => {
    const { rpID } = await getDynamicConfig();
    return rpID;
};

/**
 * Generate options for registering a new authenticator (fingerprint/FaceID)
 */
export async function generateRegisterOptions(employeeId: string, clientId: string) {
    const employee = await prisma.paydayEmployee.findUnique({
        where: { id: employeeId, clientId },
        include: { authenticators: true },
    });

    if (!employee) {
        throw new Error('Employee not found or access denied');
    }

    const { rpID, origin } = await getDynamicConfig();

    const opts: GenerateRegistrationOptionsOpts = {
        rpName,
        rpID,
        userID: employee.id, // Using internal ID as user handle
        userName: employee.cedula || employee.firstName, // Shown in browser UI
        timeout: 60000,
        attestationType: 'direct', // Request direct hardware attestation to force local authenticator
        excludeCredentials: employee.authenticators.map((auth) => ({
            id: auth.credentialID,
            type: 'public-key',
            transports: auth.transports ? JSON.parse(auth.transports) : undefined,
        })),
        authenticatorSelection: {
            residentKey: 'discouraged',
            requireResidentKey: false,
            userVerification: 'required',
            authenticatorAttachment: 'platform', // Enforce platform authenticator (TouchID/Windows Hello/Android)
        },
    };

    const options = await generateRegistrationOptions(opts);

    await prisma.systemConfig.upsert({
        where: {
            clientId_key: {
                clientId,
                key: `webauthn_challenge_${employeeId}`,
            },
        },
        update: {
            value: options.challenge,
        },
        create: {
            clientId,
            key: `webauthn_challenge_${employeeId}`,
            value: options.challenge,
            description: 'Temporary WebAuthn Challenge',
        },
    });

    return options;
}

/**
 * Verify the registration response and save the new credential
 */
export async function verifyRegistration(
    employeeId: string,
    clientId: string,
    response: any
) {
    const employee = await prisma.paydayEmployee.findUnique({
        where: { id: employeeId, clientId },
    });

    if (!employee) throw new Error('Employee not found');

    // Retrieve challenge
    const challengeConfig = await prisma.systemConfig.findUnique({
        where: {
            clientId_key: {
                clientId,
                key: `webauthn_challenge_${employeeId}`,
            },
        },
    });

    if (!challengeConfig || !challengeConfig.value) {
        throw new Error('Challenge expired or not found');
    }

    const expectedChallenge = challengeConfig.value;

    const { rpID, origin } = await getDynamicConfig();

    const opts: VerifyRegistrationResponseOpts = {
        response,
        expectedChallenge,
        expectedOrigin: origin,
        expectedRPID: rpID,
        requireUserVerification: true,
    };

    const verification = await verifyRegistrationResponse(opts);

    if (verification.verified && verification.registrationInfo) {
        const { credentialID, credentialPublicKey, counter, credentialDeviceType, credentialBackedUp } =
            verification.registrationInfo;

        // Save authenticator
        await prisma.authenticator.create({
            data: {
                employeeId,
                clientId,
                credentialID: Buffer.from(credentialID),
                credentialPublicKey: Buffer.from(credentialPublicKey),
                counter: counter,
                credentialDeviceType,
                credentialBackedUp,
                transports: JSON.stringify(response.response.transports || []), // Save transports if available
            },
        });

        // Clean up challenge
        await prisma.systemConfig.delete({
            where: {
                clientId_key: {
                    clientId,
                    key: `webauthn_challenge_${employeeId}`,
                },
            },
        });

        revalidatePath('/dashboard/payday/employees');
        return { success: true };
    }

    throw new Error('Verification failed');
}

/**
 * Generate options for authentication (Login/Check-in)
 */
export async function generateAuthOptions(clientId: string) {
    const { rpID } = await getDynamicConfig();

    // Fetch all authenticators for the client to support "Usernameless" authentication
    // without requiring Resident Keys (which trigger Google Passkey UI).
    // This scales well for small-to-medium orgs.
    const authenticators = await prisma.authenticator.findMany({
        where: { clientId },
        select: { credentialID: true, transports: true }
    });

    const allowCredentials = authenticators.map((auth) => ({
        id: auth.credentialID,
        type: 'public-key' as const,
        transports: auth.transports ? JSON.parse(auth.transports) : undefined,
    }));

    const opts: GenerateAuthenticationOptionsOpts = {
        timeout: 60000,
        userVerification: 'preferred',
        rpID,
        allowCredentials,
    };

    const options = await generateAuthenticationOptions(opts);

    // Store global challenge for the kiosk session? 
    // Since multiple people might be at kiosks, we need a session identifier or just use the clientId global store?
    // Using clientId_key is risky if multiple kiosks for same client checkin at same time (race condition).
    // Better key: `webauthn_auth_challenge_${clientId}_${timestamp_random}` passed back to client? 
    // No, client needs to send it back.
    // Let's use a random ID returned to client, and client sends it back with response.

    // Actually, we can just use the `challenge` string itself as part of the key if we could index it, 
    // but SystemConfig is key-value.
    // Let's keep it simple: We'll store it by a generated session ID we return.

    const sessionId = crypto.randomUUID();

    await prisma.systemConfig.create({
        data: {
            clientId, // Use client ID for scoping
            key: `webauthn_auth_challenge_${sessionId}`,
            value: options.challenge,
            description: 'Auth Challenge',
        },
    });

    return { options, sessionId };
}

/**
 * Verify the authentication response
 */
export async function verifyAuth(
    clientId: string,
    sessionId: string,
    response: any,
    employeeId?: string // Optional: confirm it matches this employee
) {
    // Retrieve challenge
    const challengeConfig = await prisma.systemConfig.findUnique({
        where: {
            clientId_key: {
                clientId,
                key: `webauthn_auth_challenge_${sessionId}`,
            },
        },
    });

    if (!challengeConfig) {
        throw new Error('Authentication session expired');
    }

    const expectedChallenge = challengeConfig.value;

    const { rpID, origin } = await getDynamicConfig();

    // We need to look up the authenticator by credential ID from the response
    const credentialID = response.id;

    // Find the authenticator in DB to get its public key
    // Since credentialID is Bytes in DB, we need to query carefully.
    // Prisma requires Buffer for Bytes fields.
    const credentialBuffer = Buffer.from(credentialID, 'base64url');
    // Note: simplewebauthn usually uses base64url for transport. 
    // We need to ensure format matches. response.id is usually base64url string.

    const authenticator = await prisma.authenticator.findFirst({
        where: {
            clientId,
            // Prisma byte comparison
            credentialID: { equals: credentialBuffer },
        },
        include: { employee: true },
    });

    if (!authenticator) {
        throw new Error('Authenticator not found in this organization');
    }

    const opts: VerifyAuthenticationResponseOpts = {
        response,
        expectedChallenge,
        expectedOrigin: origin,
        expectedRPID: rpID,
        authenticator: {
            credentialID: authenticator.credentialID,
            credentialPublicKey: authenticator.credentialPublicKey,
            counter: Number(authenticator.counter),
            transports: authenticator.transports ? JSON.parse(authenticator.transports) : undefined,
        },
        requireUserVerification: true,
    };

    const verification = await verifyAuthenticationResponse(opts);

    if (verification.verified && verification.authenticationInfo) {
        // Update counter
        await prisma.authenticator.update({
            where: { id: authenticator.id },
            data: {
                counter: verification.authenticationInfo.newCounter,
            },
        });

        // Delete challenge
        await prisma.systemConfig.delete({
            where: { id: challengeConfig.id }
        });

        // If employeeId was claimed, verify it matches
        if (employeeId && authenticator.employeeId !== employeeId) {
            throw new Error('Biometric credentials do not match the selected employee');
        }

        return {
            success: true,
            employeeId: authenticator.employeeId,
            firstName: authenticator.employee.firstName,
            lastName: authenticator.employee.lastName
        };
    }

    throw new Error('Verification failed');
}

// Helper to list registered authenticators
export async function getEmployeeAuthenticators(employeeId: string, clientId: string) {
    const authenticators = await prisma.authenticator.findMany({
        where: { employeeId, clientId },
        select: {
            id: true,
            createdAt: true,
            credentialDeviceType: true,
            transports: true
        }
    });
    return authenticators;
}

// Helper to delete an authenticator
export async function deleteAuthenticator(authId: string, clientId: string) {
    await prisma.authenticator.deleteMany({
        where: {
            id: authId,
            clientId // Security: ensure ownership
        }
    });
    revalidatePath('/dashboard/payday/employees');
    return { success: true };
}
