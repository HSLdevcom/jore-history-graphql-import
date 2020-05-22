import React, { useCallback } from "react";
import { PATH_PREFIX } from "../../constants";

const SelectTables = ({ disabled = true, selectedTables, removeOnly }) => {
  const onChange = useCallback(() => {}, []);

  return (
    <>
      <h3>Select tables to import</h3>
      <p>
        Select which tables should be imported when running import tasks. This will affect
        all import tasks, both scheduled and manual. The setting is kept in memory and
        will be reset when the server app restarts.
      </p>
      <form action={`${PATH_PREFIX}select-tables/`} method="post">
        <fieldset disabled={disabled}>
          <legend>Tables to import</legend>
          <ul style={{ listStyleType: "none", padding: 0 }}>
            {Object.entries(selectedTables).map(([tableName, isSelected]) => (
              <li key={tableName}>
                <label>
                  <input
                    name={tableName}
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
          <label>
            <input
              type="checkbox"
              name="remove_only"
              onChange={onChange}
              value="remove_only"
              checked={!!removeOnly}
            /> Remove only
          </label>
          <div style={{marginTop: '1rem'}}>
            <input type="submit" value="Set tables" />
          </div>
        </fieldset>
      </form>
    </>
  );
};

export default SelectTables;
