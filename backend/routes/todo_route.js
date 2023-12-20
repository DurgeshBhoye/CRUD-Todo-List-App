const express = require('express');
const todoRouter = express.Router();
const mongoose = require('mongoose');
const UserModel = mongoose.model('UserModel');
const Task = mongoose.model('Task');
const List = mongoose.model('List');
const auth = require('../middlewares/auth');


// Get all lists
todoRouter.get("/api/lists", async (req, res) => {
    try {
        const lists = await List.find().sort({ createdAt: -1 }).populate("tasks");
        // console.log(lists, "From first route");
        res.json(lists);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Create a new list:
todoRouter.post("/api/list", auth, async (req, res) => {
    try {
        // Validate user existence
        const user = await UserModel.findById(req.user._id);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }
        const list = new List({ name: req.body.name });
        await list.save();

        user.lists.push(list._id);
        await user.save();

        res.json({ success: true, id: list._id });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Get tasks within a specific list:
todoRouter.get("/api/lists/:id/tasks", async (req, res) => {
    try {
        const list = await List.findById(req.params.id).populate("tasks");
        if (!list) {
            return res.status(404).json({ error: "List not found" });
        }
        res.json(list.tasks);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Add a task to a specific list:
todoRouter.post("/api/lists/:id/tasks", async (req, res) => {
    try {

        const list = await List.findByIdAndUpdate(req.params.id);

        const todo = {
            name: req.body.task,
            description: req.body.description,
            // checked: true,
            list: req.params.id,
        };

        list.tasks.push(todo);
        await list.save();
        res.json({ success: true, id: list._id });

    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Delete a task from a specific list
todoRouter.delete("/api/lists/:listId/tasks/:taskId", async (req, res) => {
    try {
        // Find the list
        const list = await List.findById(req.params.listId);
        if (!list) {
            return res.status(404).json({ error: "List not found" });
        }

        // Check if the task exists in the list
        const taskExists = list.tasks.some((task) => task._id.toString() === req.params.taskId);
        if (!taskExists) {
            return res.status(404).json({ error: "Task not found in list" });
        }

        // Find and delete the task from the list's tasks array
        list.tasks.pull({ _id: req.params.taskId });

        // Update the list with the removed task
        await List.findByIdAndUpdate(req.params.listId, list, { new: true }); // Update the list and return the updated document

        res.json({ success: true, id: list._id });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});


// Update task name and description
todoRouter.put("/api/lists/:id/tasks/:taskId", async (req, res) => {
    try {
        // Find the list and task
        const list = await List.findById(req.params.id);
        if (!list) {
            return res.status(404).json({ error: "List not found" });
        }
        const taskToUpdate = list.tasks.find(task => task._id.toString() === req.params.taskId);
        if (!taskToUpdate) {
            return res.status(404).json({ error: "Task not found in list" });
        }

        // console.log("Task Before updating name:", taskToUpdate);

        // Update the task properties based on request body
        const { task, description } = req.body;
        if (task) {
            taskToUpdate.name = task;
            // console.log("Task after updating name:", taskToUpdate);
        }

        if (description) {
            taskToUpdate.description = description;
            // console.log("Task after updating description:", taskToUpdate);
        }


        await list.save();

        res.json({ success: true, id: list._id, updatedTask: taskToUpdate });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});


// delete a list from the database
todoRouter.delete("/api/list/:id", async (req, res) => {
    try {
        const list = await List.findByIdAndDelete(req.params.id);
        if (!list) {
            return res.status(404).json({ error: "Task not found" });
        }

        const users = await UserModel.find({});

        // console.log(users);

        for (const user of users) {
            user.lists = user.lists.filter(list => list.toString() !== req.params.id);
            // console.log(user.lists);
            await user.save();
        }

        res.json({ success: true });

    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});


// Update a list Name
todoRouter.put("/api/list/:id", async (req, res) => {
    try {
        const list = await List.findByIdAndUpdate(req.params.id, {
            name: req.body.listName,
        });
        if (!list) {
            return res.status(404).json({ error: "List not found" });
        }
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});



// Update checked state
todoRouter.put("/api/lists/:id/tasks/:taskId/checked", async (req, res) => {
    try {
        // Find the list and task
        const list = await List.findById(req.params.id);
        if (!list) {
            return res.status(404).json({ error: "List not found" });
        }
        const taskToUpdate = list.tasks.find(task => task._id.toString() === req.params.taskId);
        if (!taskToUpdate) {
            return res.status(404).json({ error: "Task not found in list" });
        }


        const { checked } = req.body;

        taskToUpdate.checked = checked;


        await list.save();

        res.json({ success: true, id: list._id, updatedTask: taskToUpdate });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

// get single user's tasks lists
todoRouter.get('/users/lists', auth, async (req, res) => {
    const userId = req.user._id;                                   // Get the user ID from the route parameter
    const user = await UserModel.findById(userId);                     // Fetch the user data
    const createdLists = user.lists;                       // Get the createdLists array from the user object

    const products = await List.find({ _id: { $in: createdLists } }).sort({ createdAt: -1 }) // Filter products by createdLists array
    res.send({ products });
}
);


// Add list to user's data
todoRouter.post('/users/lists', auth, async (req, res) => {
    const userId = req.user.id;
    const { name } = req.body;

    // Validate user existence
    const user = await UserModel.findById(userId);
    if (!user) {
        return res.status(404).json({ message: 'User not found' });
    }

    // Create new list document
    const newList = new List({ name });

    user.lists.push(newList._id);
    await user.save();

    // Save the new list and return it
    await newList.save();
    return res.json({ list: newList });
});


module.exports = todoRouter;