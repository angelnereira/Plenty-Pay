import { prisma } from "@/lib/db";

export class ConfigService {
    /**
     * Get a configuration value by key
     */
    async get<T>(clientId: string, key: string, defaultValue?: T): Promise<T | undefined> {
        const config = await prisma.systemConfig.findUnique({
            where: {
                clientId_key: {
                    clientId,
                    key
                }
            }
        });

        if (!config) {
            return defaultValue;
        }

        try {
            return JSON.parse(config.value) as T;
        } catch (e) {
            console.error(`[CONFIG_SERVICE] Failed to parse config value for key ${key}`, e);
            return defaultValue;
        }
    }

    /**
     * Set a configuration value
     */
    async set(clientId: string, key: string, value: any, userId?: string) {
        const stringValue = JSON.stringify(value);

        return prisma.systemConfig.upsert({
            where: {
                clientId_key: {
                    clientId,
                    key
                }
            },
            update: {
                value: stringValue,
                updatedBy: userId
            },
            create: {
                clientId,
                key,
                value: stringValue,
                updatedBy: userId
            }
        });
    }

    /**
     * Get multiple configuration values
     */
    async getMany(clientId: string, keys: string[]) {
        const configs = await prisma.systemConfig.findMany({
            where: {
                clientId,
                key: {
                    in: keys
                }
            }
        });

        const result: Record<string, any> = {};

        // Initialize with undefined
        keys.forEach(key => result[key] = undefined);

        // Fill found values
        configs.forEach(config => {
            try {
                result[config.key] = JSON.parse(config.value);
            } catch (e) {
                console.error(`[CONFIG_SERVICE] Failed to parse config value for key ${config.key}`, e);
            }
        });

        return result;
    }
}
