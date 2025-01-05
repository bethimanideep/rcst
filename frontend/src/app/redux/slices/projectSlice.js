import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  showForm: false,
  projects: [],
  selectedProjectId: null,
};

const projectSlice = createSlice({
  name: 'projects',
  initialState,
  reducers: {
    setProjects: (state, action) => {
      state.projects = action.payload;
    },
    setSelectedProjectId: (state, action) => {
      state.selectedProjectId = action.payload;
    },
    toggleShowForm: (state) => {
      state.showForm = !state.showForm;
    },
  },
});

export const { setProjects, setSelectedProjectId, toggleShowForm } = projectSlice.actions;
export default projectSlice.reducer;
