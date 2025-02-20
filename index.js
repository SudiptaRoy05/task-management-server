require('dotenv').config();
const express = require('express');
const cors = require('cors');
const port = process.env.PORT || 5000;

const app = express();
app.use(cors());
app.use(express.json());

console.log(process.env.DB_PASS)

const { MongoClient, ServerApiVersion } = require('mongodb');
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.lue0n.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function run() {
  try {
    const database = client.db('TaskManagement');
    const taskCollection = database.collection('tasks');

    app.post('/tasks', async (req, res) => {
        const task = req.body;
        const result = await taskCollection.insertOne(task);
        res.json(result);
    });
    
  } finally {
  }
}
run().catch(console.dir);




app.get('/', (req, res) => {
    res.send('Task Management server started successfully');
})

app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
})