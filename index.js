require('dotenv').config();
const express = require('express');
const cors = require('cors');
const http = require('http'); // Required for WebSockets
const { Server } = require('socket.io');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');

const port = process.env.PORT || 5000;
const app = express();
const server = http.createServer(app); // WebSocket-compatible server
const io = new Server(server, {
    cors: {
        origin: "http://localhost:5173", // Replace with your frontend URL
        methods: ["GET", "POST", "PUT", "DELETE"],
    },
});

app.use(cors());
app.use(express.json());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.lue0n.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

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

        // WebSocket Connection
        io.on("connection", (socket) => {
            console.log("Client connected:", socket.id);

            // Fetch and send all tasks on connection
            const sendTasks = async () => {
                const tasks = await taskCollection.find().toArray();
                io.emit("taskUpdated", tasks);
            };

            // Get all tasks
            app.get('/tasks', async (req, res) => {
                const tasks = await taskCollection.find().toArray();
                res.json(tasks);
            });

            // Add a task
            app.post('/tasks', async (req, res) => {
                const task = req.body;
                const result = await taskCollection.insertOne(task);
                await sendTasks(); // Emit update
                res.json(result);
            });

            // Update a task
            app.put('/tasks/:id', async (req, res) => {
                const id = req.params.id;
                const task = req.body;
                const result = await taskCollection.updateOne({ _id: new ObjectId(id) }, { $set: task });
                await sendTasks(); // Emit update
                res.json(result);
            });

            // Delete a task
            app.delete('/tasks/:id', async (req, res) => {
                const id = req.params.id;
                const result = await taskCollection.deleteOne({ _id: new ObjectId(id) });
                await sendTasks(); // Emit update
                res.json(result);
            });

            socket.on("disconnect", () => {
                console.log("Client disconnected:", socket.id);
            });
        });

    } finally {
    }
}
run().catch(console.dir);

app.get('/', (req, res) => {
    res.send('Task Management server started successfully');
});

server.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});
