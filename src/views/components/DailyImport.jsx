import React from "react";

const DailyImport = ({ disabled }) => {
  return (
    <>
      <h3>Run daily import now</h3>
      <p>
        The daily import is a scheduled task that runs every night at around 3 in the
        morning. With this button, you can run it manually. This UI is disabled while the
        import is running. The task will download the latest daily export, but will not
        import the same export twice.
      </p>
      <form action="/run-daily" method="post">
        <input disabled={disabled} type="submit" value="Run import task" />
      </form>
    </>
  );
};

export default DailyImport;
