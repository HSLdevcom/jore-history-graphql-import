import React, { useCallback } from "react";

const SelectTables = ({ readOnly = true, selectedTables }) => {
  const onChange = useCallback(() => {}, []);

  return (
    <>
      <h3>Select tables to import</h3>
      <p>
        Select which tables should be imported when running import tasks. This will affect
        all import tasks, both scheduled and manual. The setting is kept in memory and
        will be reset when the server app restarts.
      </p>
      <form action="/select-tables" method="post">
        <fieldset disabled={readOnly}>
          <legend>Tables to import</legend>
          <ul style={{ listStyleType: "none", padding: 0 }}>
            {Object.entries(selectedTables).map(([tableName, isSelected]) => (
              <li>
                <label>
                  <input
                    onChange={onChange}
                    type="checkbox"
                    value={tableName}
                    checked={isSelected}
                  />
                  {tableName}
                </label>
              </li>
            ))}
          </ul>
          <input type="submit" value="Set tables" />
        </fieldset>
      </form>
    </>
  );
};

export default SelectTables;
