require('dotenv').config();
const express = require('express');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');

const port = process.env.PORT || 5000;
const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "https://task-management-db2f8.web.app",
        methods: ["GET", "POST", "PUT", "DELETE"],
    },
});

app.use(cors());
app.use(express.json());

// Validate environment variables
if (!process.env.DB_USER || !process.env.DB_PASS) {
    console.error("DB_USER or DB_PASS environment variables are missing.");
    process.exit(1);
}

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
        await client.connect();
        console.log("Connected to MongoDB");

        const database = client.db('TaskManagement');
        const taskCollection = database.collection('tasks');
        const userCollection = database.collection('users');

        // Function to send updated tasks to all clients
        const sendTasks = async () => {
            try {
                const tasks = await taskCollection.find().toArray();
                io.emit("TASK_UPDATED", tasks);
            } catch (error) {
                console.error("Error fetching tasks for WebSocket:", error);
            }
        };

        // WebSocket connection
        io.on("connection", (socket) => {
            console.log(`Client connected: ${socket.id}`);
            sendTasks(); // Send tasks when a client connects

            socket.on("disconnect", () => {
                console.log(`Client disconnected: ${socket.id}`);
            });
        });

        // API: Get tasks by user email
        app.get('/tasks', async (req, res) => {
            try {
                const email = req.query.email;
                if (!email) {
                    return res.status(400).json({ message: "Email is required" });
                }

                const tasks = await taskCollection.find({ email }).toArray();
                if (tasks.length === 0) {
                    return res.status(404).json({ message: "No tasks found for this email" });
                }
                res.json(tasks);
            } catch (error) {
                console.error("Error fetching tasks:", error);
                res.status(500).json({ message: "Internal Server Error", error: error.message });
            }
        });

        // API: Add a task
        app.post('/tasks', async (req, res) => {
            try {
                const task = req.body;
                if (!task.title || !task.description || !task.email || !task.status) {
                    return res.status(400).json({ message: "Title, description, email, and status are required" });
                }

                const result = await taskCollection.insertOne(task);
                await sendTasks(); // Emit updated tasks
                res.status(201).json(result);
            } catch (error) {
                console.error("Error adding task:", error);
                res.status(500).json({ message: "Internal Server Error", error: error.message });
            }
        });

        // API: Update a task (PUT)
        app.put('/tasks/:id', async (req, res) => {
            try {
                const id = req.params.id;
                const task = req.body;
                delete task._id; // Prevent _id update

                if (!ObjectId.isValid(id)) {
                    return res.status(400).json({ message: "Invalid task ID" });
                }

                const result = await taskCollection.updateOne(
                    { _id: new ObjectId(id) },
                    { $set: task }
                );

                if (result.matchedCount === 0) {
                    return res.status(404).json({ message: "Task not found" });
                }

                await sendTasks(); // Emit updated tasks
                res.json(result);
            } catch (error) {
                console.error("Error updating task:", error);
                res.status(500).json({ message: "Internal Server Error", error: error.message });
            }
        });

        // API: Partially update a task (PATCH)
        app.patch('/tasks/:id', async (req, res) => {
            try {
                const id = req.params.id;
                const updates = req.body;
                delete updates._id; // Prevent _id update

                if (!ObjectId.isValid(id)) {
                    return res.status(400).json({ message: "Invalid task ID" });
                }

                const result = await taskCollection.updateOne(
                    { _id: new ObjectId(id) },
                    { $set: updates }
                );

                if (result.matchedCount === 0) {
                    return res.status(404).json({ message: "Task not found" });
                }

                await sendTasks(); // Emit updated tasks
                res.json(result);
            } catch (error) {
                console.error("Error updating task:", error);
                res.status(500).json({ message: "Internal Server Error", error: error.message });
            }
        });

        // API: Delete a task
        app.delete('/tasks/:id', async (req, res) => {
            try {
                const id = req.params.id;

                if (!ObjectId.isValid(id)) {
                    return res.status(400).json({ message: "Invalid task ID" });
                }

                const result = await taskCollection.deleteOne({ _id: new ObjectId(id) });

                if (result.deletedCount === 0) {
                    return res.status(404).json({ message: "Task not found" });
                }

                await sendTasks(); // Emit updated tasks
                res.json({ message: "Task deleted successfully" });
            } catch (error) {
                console.error("Error deleting task:", error);
                res.status(500).json({ message: "Internal Server Error", error: error.message });
            }
        });

        // API: Create a new user
        app.post('/user', async (req, res) => {
            try {
                const user = req.body;

                if (!user.email || !user.name) {
                    return res.status(400).json({ message: "Email and name are required" });
                }

                const existingUser = await userCollection.findOne({ email: user.email });

                if (existingUser) {
                    return res.status(409).json({ message: "User already exists" });
                }

                const result = await userCollection.insertOne(user);
                res.status(201).json(result);
            } catch (error) {
                console.error("Error creating user:", error);
                res.status(500).json({ message: "Internal Server Error", error: error.message });
            }
        });

    } catch (error) {
        console.error("Error connecting to MongoDB:", error);
    }
}

run().catch(console.dir);

app.get('/', (req, res) => {
    res.json({
        message: 'Task Management server is running',
        status: 'OK',
        version: '1.0.0',
    });
});

server.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});