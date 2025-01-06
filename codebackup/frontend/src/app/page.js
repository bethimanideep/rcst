"use client";

import { useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import NavBar from "./components/NavBar";
import Form from "./components/Form";
import Dashboard from "./components/Dashboard";
import { setProjects, toggleShowForm, setSelectedProjectId } from "./redux/slices/projectSlice";

import "./css/App.css";

let socket;

export default function Home() {
  const dispatch = useDispatch();
  const { showForm, projects, selectedProjectId } = useSelector((state) => state.projects);

  useEffect(() => {
    fetchProjects();

    return () => {
      if (socket) {
        socket.disconnect();
      }
    };
  }, []);

  const fetchProjects = async () => {
    try {
      const response = await fetch("http://localhost:8080/getprojects");
      if (!response.ok) throw new Error("Failed to fetch projects");
      const data = await response.json();
      dispatch(setProjects(data));
    } catch (error) {
      console.error("Error fetching projects:", error);
    }
  };

  const handleProjectClick = (projectId) => {
    dispatch(setSelectedProjectId(projectId));
  };

  return (
      <div className="container">
        <NavBar onCreateProject={() => dispatch(toggleShowForm(true))} />
        <div className="content">
          <div className="projects">
            {projects.map((project) => (
              <div key={project._id} className="project-card">
                <button onClick={() => handleProjectClick(project._id)}>
                  {project.displayName}
                </button>
              </div>
            ))}
          </div>
          {selectedProjectId && <Dashboard projectId={selectedProjectId} />}
          {showForm && (
            <div className="popup-overlay">
              <div className="popup">
                <button className="close-button" onClick={() => dispatch(toggleShowForm())}>
                  &times;
                </button>
                <Form />
              </div>
            </div>
          )}
        </div>
      </div>
  );
}
