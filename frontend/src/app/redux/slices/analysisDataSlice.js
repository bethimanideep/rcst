import { createSlice } from "@reduxjs/toolkit";

const initialState = {
  analysisData: {},
};

const analysisDataSlice = createSlice({
  name: "analysisData",
  initialState,
  reducers: {
    setAnalysisData: (state, action) => {
      state.analysisData = action.payload;
    },
    setAnalysisDataKeyValue: (state, action) => {
      const { key, value } = action.payload;
      state.analysisData[key] = value;
    },
  },
});

export const { setAnalysisData, setAnalysisDataKeyValue } = analysisDataSlice.actions;
export default analysisDataSlice.reducer;
