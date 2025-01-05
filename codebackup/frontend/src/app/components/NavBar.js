"use client";

export default function NavBar({ onCreateProject }) {
  return (
    <nav className="navbar">
      <h1 className="navbar-title">Dashboard</h1>
      <div className="navbar-buttons">
        <button className="btn" onClick={onCreateProject}>
          Create Project
        </button>
        <button className="btn">Import</button>
      </div>
    </nav>
  );
}
