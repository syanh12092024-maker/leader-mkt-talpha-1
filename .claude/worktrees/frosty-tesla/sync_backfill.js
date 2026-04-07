const { TAlphaAdsModel } = require('./src/lib/bigquery/models/talpha-ads.model');
const { GoogleSheetsSyncService } = require('./src/lib/google-sheets/services/talpha-sync.service');

async function backfill() {
    const sheetId = '1-kY-bLJUYS_PPogDVydY1T330D67Cj2RK8lF8E1rzoI';
    const syncService = new GoogleSheetsSyncService(sheetId);

    const dates = [
        '2026-03-01',
        '2026-03-02',
        '2026-03-03',
        '2026-03-04',
        '2026-03-05'
    ];

    console.log('🚀 Starting Data Backup to Google Sheets...');

    for (const date of dates) {
        try {
            console.log(`\n📅 Processing ${date}...`);

            // 1. Fetch
            const ads = await TAlphaAdsModel.fetchMetaAds(date, date);
            const orders = await TAlphaAdsModel.fetchPOSHybrid(date, date);

            // 2. Aggregate
            const result = TAlphaAdsModel.aggregate(ads, orders);

            // 3. Sync
            await syncService.syncAdsData({
                date,
                ...result
            });

            console.log(`✅ ${date}: Success (Spend: ${result.total_spend} VND)`);
        } catch (err) {
            console.error(`❌ ${date}: Error - ${err.message}`);
        }
    }

    console.log('\n✨ Backup Complete!');
}

backfill().catch(err => console.error('FATAL ERROR:', err));
