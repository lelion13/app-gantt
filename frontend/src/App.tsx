import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";

import { ProtectedLayout } from "@/components/ProtectedLayout";
import { AuthProvider } from "@/context/AuthContext";
import AdminUsersPage from "@/pages/AdminUsersPage";
import DashboardPage from "@/pages/DashboardPage";
import LoginPage from "@/pages/LoginPage";
import ProjectPage from "@/pages/ProjectPage";
import ProjectTasksPage from "@/pages/ProjectTasksPage";
import TaskDetailPage from "@/pages/TaskDetailPage";

import "@/App.css";

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route element={<ProtectedLayout />}>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/projects/:projectId" element={<ProjectPage />} />
            <Route path="/projects/:projectId/tasks" element={<ProjectTasksPage />} />
            <Route
              path="/projects/:projectId/tasks/:taskId"
              element={<TaskDetailPage />}
            />
            <Route path="/admin/users" element={<AdminUsersPage />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
