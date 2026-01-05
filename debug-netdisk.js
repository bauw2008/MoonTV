const { db } = require('./src/lib/db.ts');

async function debugNetdiskConfig() {
  try {
    const config = await db.getAdminConfig();
    console.log(
      'NetDiskConfig from database:',
      JSON.stringify(config.NetDiskConfig, null, 2),
    );
    console.log(
      'MenuSettings.showNetDiskSearch:',
      config.SiteConfig?.MenuSettings?.showNetDiskSearch,
    );
  } catch (error) {
    console.error('Error:', error);
  }
}

debugNetdiskConfig();
