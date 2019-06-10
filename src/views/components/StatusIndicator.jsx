/* eslint-disable camelcase */
import React from "react";
import { format } from "date-fns";

const DATE_FORMAT = "HH:mm:ss YYYY-MM-DD";

const StatusIndicator = ({ isImporting, latestImportedFile = {} }) => {
  const { filename = "", import_start, import_end, success = false } =
    latestImportedFile || {};

  return (
    <>
      <h4 style={{ color: isImporting ? "red" : "green" }}>
        {isImporting ? "Import in progress!" : "Standing by..."}
      </h4>
      {filename && (
        <>
          <p>
            The latest imported export was <strong>{filename}</strong>.{" "}
            {success &&
              import_end && (
                <>
                  The import started at{" "}
                  <strong>{format(import_start, DATE_FORMAT)}</strong> and{" "}
                  <strong style={{ color: "green" }}>ended successfully</strong> at{" "}
                  <strong>{format(import_end, DATE_FORMAT)}</strong>.{" "}
                </>
              )}
            {!success && (
              <>
                The import started at <strong>{format(import_start, DATE_FORMAT)}</strong>{" "}
                but did <strong style={{ color: "red" }}>not successfully</strong> finish.
              </>
            )}
          </p>
        </>
      )}
    </>
  );
};

export default StatusIndicator;
