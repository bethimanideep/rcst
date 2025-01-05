import { useEffect } from "react";
import io from "socket.io-client";
import "../css/Dashboard.css"; // Add styles for the editor
import { useDispatch, useSelector } from "react-redux";
import { setAnalysisData } from "../redux/slices/analysisDataSlice";

export default function Dashboard({ projectId }) {
  const dispatch = useDispatch();
  const analysisData = useSelector((state) => state.analysisData.analysisData);

  useEffect(() => {
    fetchAnalysisData();

    const socket = io("http://localhost:8080");
    socket.on("connect", () => console.log("Socket connected:", socket.id));
    socket.on("disconnect", () => console.log("Socket disconnected"));

    socket.on("analysisDataUpdate", (data) => {
      if (data.projectId === projectId) {
        dispatch(setAnalysisData(data.analysisData));
      }
    });

    return () => {
      socket.disconnect();
    };
  }, [projectId, dispatch]);

  const fetchAnalysisData = async () => {
    try {
      const response = await fetch("http://localhost:8080/analysisdata", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ projectId }),
      });
      if (!response.ok) throw new Error("Failed to fetch analysis data");
      const data = await response.json();
      dispatch(setAnalysisData(data));
    } catch (error) {
      console.error("Error fetching analysis data:", error);
    }
  };

  if (!analysisData) {
    return <div>Loading...</div>;
  }

  const { sastAnalysis, scaAnalysis, secretDetectionAnalysis, dependencyAnalysis } = analysisData;

  return (
    <div className="dashboard">
      <h2>Analysis Data for Project</h2>

      {sastAnalysis.length > 0 && (
        <>
          <h3>SAST Analysis</h3>
          <textarea
            className="read-only-editor"
            readOnly
            value={JSON.stringify(sastAnalysis, null, 2)}
          />
        </>
      )}

      {scaAnalysis.length > 0 && (
        <>
          <h3>SCA Analysis</h3>
          <textarea
            className="read-only-editor"
            readOnly
            value={JSON.stringify(scaAnalysis, null, 2)}
          />
        </>
      )}

      {secretDetectionAnalysis.length > 0 && (
        <>
          <h3>Secret Detection Analysis</h3>
          <textarea
            className="read-only-editor"
            readOnly
            value={JSON.stringify(secretDetectionAnalysis, null, 2)}
          />
        </>
      )}

      {dependencyAnalysis.length > 0 && (
        <>
          <h3>Dependency Analysis</h3>
          <textarea
            className="read-only-editor"
            readOnly
            value={JSON.stringify(dependencyAnalysis, null, 2)}
          />
        </>
      )}
    </div>
  );
}
