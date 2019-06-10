import React from "react";

const StatusIndicator = ({ isImporting }) => {
  return (
    <h4 style={{ color: isImporting ? "red" : "green" }}>
      {isImporting ? "Import in progress!" : "Standing by..."}
    </h4>
  );
};

export default StatusIndicator;
