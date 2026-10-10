import 'dotenv/config';
import { prismaServer as prisma } from '../core/database';

/**
 * Diagnostic & Recovery Script
 * 
 * Finds campaigns that have been in 'SENDING' status for too long
 * and allows resetting them to 'FAILED' so they don't block UI 
 * or can be manually retried if needed.
 */
async function fixStalledCampaigns() {
    console.log('--- CRM Stalled Campaigns Recovery Tool ---');
    
    // threshold: campaigns created more than 2 hours ago and still 'SENDING'
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
    
    const stalled = await prisma.emailCampaign.findMany({
        where: {
            status: 'SENDING',
            createdAt: { lt: twoHoursAgo }
        }
    });
    
    if (stalled.length === 0) {
        console.log('NO stalled campaigns found (SENDING status for > 2 hours).');
        return;
    }
    
    console.log(`Found ${stalled.length} stalled campaigns:`);
    stalled.forEach(c => {
        console.log(`- [${c.id}] Created: ${c.createdAt.toLocaleString()} | Subject: ${c.subject}`);
    });
    
    console.log('\nResetting them to FAILED to allow manual intervention...');
    
    const result = await prisma.emailCampaign.updateMany({
        where: {
            id: { in: stalled.map(c => c.id) }
        },
        data: {
            status: 'FAILED'
        }
    });
    
    console.log(`Updated ${result.count} campaigns to FAILED.`);
    console.log('Done.');
}

fixStalledCampaigns()
    .catch(err => {
        console.error('CRITICAL ERROR:', err);
        process.exit(1);
    })
    .finally(() => prisma.$disconnect());
