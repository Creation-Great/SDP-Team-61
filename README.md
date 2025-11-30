# 🎓 AI Peer Review System  
A full-stack web application for assignment submission, peer review task assignment, and student review viewing.  
Built with **Node.js**, **Express**, **MongoDB**, **React**, and **Framer Motion**.

---

## 📌 Overview

The AI Peer Review System allows students to upload assignments, automatically assigns peer reviewers, and enables reviewers to provide feedback. Students can later view the completed feedback along with scores and comments.  
This system supports:

- Secure file uploads  
- Automated reviewer selection  
- Reviewer dashboard  
- Student dashboard  
- Viewing completed peer reviews  
- AI (future): automatic summaries of documents  

---

## 🚀 Features

### 🧑‍🎓 Student Features
- Upload assignments with PDF or DOCX files  
- See all submitted assignments  
- Track review status  
- View reviewer feedback  
- Download uploaded files  

### 🧑‍🏫 Reviewer Features
- View assigned review tasks  
- Open student documents  
- Submit comment + score  
- Mark reviews as completed  

### 🧠 AI (Future Feature)
- Auto-generate summaries of uploaded PDFs  
- Help reviewers understand content quicker  

---

## 🛠️ Tech Stack

### **Frontend**
- React  
- React Router  
- Axios  
- Framer Motion  
- Vite  

### **Backend**
- Node.js  
- Express.js  
- MongoDB + Mongoose  
- Multer (file uploads)  
- JWT Authentication  

---

## 📁 Project Structure

```
AI-Peer-Review-System/
│
├── backend/
│   ├── src/
│   │   ├── controllers/
│   │   ├── middleware/
│   │   ├── models/
│   │   └── routes/
│   ├── uploads/
│   │   └── .gitkeep
│   ├── package.json
│   └── .gitignore
│
├── frontend/
│   ├── src/
│   ├── package.json
│   └── .gitignore
│
├── README.md
└── .gitignore
```

---

# 🧩 Setup Instructions (For Teammates)

Follow these steps to run the project on your machine.

---

## 1️⃣ Clone the Repository

```bash
git clone https://github.com/Creation-Great/SDP-Team-61.git
cd SDP-Team-61
```

---

# 🗄️ Backend Setup

Navigate into the backend folder:

```bash
cd backend
```

### Install backend dependencies:

```bash
npm install
```

### Create required folders:

```bash
mkdir -p uploads
```

This folder stores uploaded assignments.  
It contains a `.gitkeep` file so that GitHub keeps the folder.

### Create a `.env` file:

Inside `/backend`, create:

```
.env
```

Add the following:

```
MONGO_URI=your_mongodb_connection_string_here
JWT_SECRET=your_secret_key_here
```

If you're unsure what to use:

- Ask the team member hosting MongoDB  
- Or install **MongoDB Atlas** (cloud)  
- Or install **MongoDB Local**

### Start the backend server:

```bash
npm start
```

Backend is running on:

```
http://localhost:8000
```

Leave this terminal open.

---

# 💻 Frontend Setup

Open a **new terminal** (keep the backend running).

Navigate to the frontend folder:

```bash
cd frontend
```

Install dependencies:

```bash
npm install
```

Start the development server:

```bash
npm run dev
```

Frontend will run on:

```
http://localhost:5173
```

---

## 4️⃣ Login & Usage

### Default Steps
1. Register a new account  
2. Log in  
3. Upload an assignment  
4. Reviewer will see tasks in their dashboard  
5. Reviewer submits a review  
6. Student can view completed review under *View Review*  

---

## 5️⃣ Troubleshooting

### ❗ Backend fails to start  
Check `.env` file exists and contains:

```
MONGO_URI=
JWT_SECRET=
```

### ❗ Cannot upload files  
Ensure this folder exists:

```
backend/uploads/
```

### ❗ CORS or network errors  
Restart both servers:
```bash
cd backend && npm start
cd frontend && npm run dev
```

---

# 🔐 Environment Variables

Backend requires:

| Variable | Description |
|----------|-------------|
| `MONGO_URI` | MongoDB connection URL |
| `JWT_SECRET` | Key for JWT authentication |

---

# 📡 API Routes

### **Assignments**

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/assignments/upload` | Student uploads assignment |
| GET | `/api/assignments/mine` | Get logged-in student's assignments |
| GET | `/api/assignments/all` | Instructor view of all assignments |
| GET | `/api/assignments/reviews/my-tasks` | Reviewer’s assigned tasks |

---

### **Reviews**

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/reviews/by-assignment/:assignmentId` | Student: view reviewer feedback |
| GET | `/api/reviews/:id` | Fetch one review |
| POST | `/api/reviews/:id/submit` | Reviewer submits a review |

---

# 📂 Uploads Folder

Git does **not** track real uploaded PDFs.  
To keep the folder in GitHub, a `.gitkeep` file is included.

`.gitignore` rule:

```
uploads/*
!uploads/.gitkeep
```

Every teammate will automatically get the folder when cloning.

---

# 📸 Screenshots (Add later)

You may include screenshots like:

```
/screenshots/
   dashboard.png
   upload-page.png
   review-form.png
```

---

# 👥 Team 61

| Name | Role |
|------|------|
| Dhruv Tyagi | Lead Developer |
| Add member | Developer |
| Add member | Reviewer | 
| Add member | Documentation |

---

# 📜 License

Project created for academic use under UConn School of Engineering.  
Team 61 – Senior Design Project.

---

# 🎯 Notes

- Backend must run before frontend  
- Ensure MongoDB URI is valid  
- Only `.gitkeep` exists in uploads directory  
- Real PDF uploads stay local, not in GitHub  
