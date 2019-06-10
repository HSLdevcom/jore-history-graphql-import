import React from "react";
import StatusIndicator from "./components/StatusIndicator";
import DailyImport from "./components/DailyImport";
import SelectTables from "./components/SelectTables";
import UploadExport from "./components/UploadExport";

const AdminView = ({ isImporting, selectedTables }) => {
  return (
    <>
      <h1>JORE history import admin</h1>
      <StatusIndicator isImporting={isImporting} />
      <hr />
      <DailyImport disabled={isImporting} />
      <UploadExport disabled={isImporting} />
      <SelectTables disabled={isImporting} selectedTables={selectedTables} />
    </>
  );
};

export default AdminView;
