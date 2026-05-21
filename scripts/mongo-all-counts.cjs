const { MongoClient } = require("mongodb");

const uri = "mongodb://MatrixAdmin:MatrixAdminPass001@13.201.165.17:27017/matrix?authSource=admin";

async function main() {
  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db("matrix");
  const collections = await db.listCollections().toArray();
  const names = collections.map((c) => c.name).sort();
  const out = {};
  for (const name of names) {
    out[name] = await db.collection(name).countDocuments();
  }
  console.log(JSON.stringify(out, null, 2));
  await client.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
