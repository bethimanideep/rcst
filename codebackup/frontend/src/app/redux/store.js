import { configureStore } from '@reduxjs/toolkit';
import projectReducer from './slices/projectSlice';
import analysisDataReducer from './slices/analysisDataSlice'; // Assuming you have this file already

const store = configureStore({
  reducer: {
    projects: projectReducer,
    analysisData: analysisDataReducer, // Assuming you have this file already
  },
});

export default store;
