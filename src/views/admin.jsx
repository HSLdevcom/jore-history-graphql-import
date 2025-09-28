import React from 'react'
import StatusIndicator from './components/StatusIndicator'
import DailyImport from './components/DailyImport'
import SelectTables from './components/SelectTables'
import UploadExport from './components/UploadExport'
import { PATH_PREFIX } from '../constants'

const AdminView = ({
  manualDumpInProgress,
  isImporting,
  latestImportedFile,
  selectedTables,
  importEnabled,
  removeEnabled,
}) => {
  return (
    <>
      <small>Version 1.4</small>
      <h1>JORE history import admin</h1>
      <StatusIndicator isImporting={isImporting} latestImportedFile={latestImportedFile} />
      <hr />
      <DailyImport disabled={isImporting || manualDumpInProgress} />
      <UploadExport disabled={isImporting || manualDumpInProgress} />
      <SelectTables
        disabled={isImporting}
        selectedTables={selectedTables}
        importEnabled={importEnabled}
        removeEnabled={removeEnabled}
      />

      <h3>Upload dump of DB</h3>

      {manualDumpInProgress && <p>Dump in progress.</p>}
      {isImporting && <p>Dump disabled during import.</p>}

      <form action={`${PATH_PREFIX}dump-upload/`} method="post">
        <input
          disabled={isImporting || manualDumpInProgress}
          type="submit"
          value="Create and upload dump"
        />
      </form>
    </>
  )
}

export default AdminView
