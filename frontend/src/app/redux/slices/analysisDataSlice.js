import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  analysisData: null,
};

const analysisDataSlice = createSlice({
  name: 'analysisData',
  initialState,
  reducers: {
    setAnalysisData: (state, action) => {
      state.analysisData = action.payload;
    },
  },
});

export const { setAnalysisData } = analysisDataSlice.actions;
export default analysisDataSlice.reducer;
