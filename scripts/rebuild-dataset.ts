import { rebuildFromDataDir } from "../src/lib/store";

rebuildFromDataDir()
  .then(({ dataset, warnings }) => {
    for (const w of warnings) console.warn(w);
    console.log(
      `records=${dataset.meta.recordCount} molds=${dataset.meta.moldCount} machines=${dataset.meta.machineCount} files=${dataset.meta.sourceFiles.length}`
    );
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
