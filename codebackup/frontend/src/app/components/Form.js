"use client";

import { useState } from "react";
import { setProjects ,toggleShowForm} from "../redux/slices/projectSlice";
import { useDispatch } from "react-redux";


export default function Form() {
  const dispatch = useDispatch();
  const [displayName, setDisplayName] = useState("");
  const [projectName, setProjectName] = useState("");


  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const response = await fetch("http://localhost:8080/createproject", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ displayName, projectKey: projectName }),
      });

      if (response.ok) {
        alert("Project created successfully!");
        fetchProjects();
        dispatch(toggleShowForm(false));
      } else {
        const data = await response.json();
        alert(`Error: ${data.message}`);
      }
    } catch (error) {
      console.error("Error during form submission:", error);
      alert("Error submitting the form");
    }
  };

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

  return (
    <form onSubmit={handleSubmit} className="form">
      <h2>Create Project</h2>
      <div className="form-group">
        <label>Display Name</label>
        <input
          type="text"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          required
        />
      </div>
      <div className="form-group">
        <label>Project Key</label>
        <input
          type="text"
          value={projectName}
          onChange={(e) => setProjectName(e.target.value)}
          required
        />
      </div>
      <button type="submit" className="form-submit">
        Submit
      </button>
    </form>
  );
}
