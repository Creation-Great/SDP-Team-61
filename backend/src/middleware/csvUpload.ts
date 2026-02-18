import multer from 'multer';

const csvStorage = multer.memoryStorage();

const csvFileFilter = (_req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const isCsvMime =
    file.mimetype === 'text/csv' ||
    file.mimetype === 'application/csv' ||
    file.mimetype === 'application/vnd.ms-excel';
  const isCsvName = file.originalname.toLowerCase().endsWith('.csv');

  if (isCsvMime || isCsvName) {
    cb(null, true);
    return;
  }

  cb(new Error('Only CSV files are allowed for peer review import'));
};

export const csvUpload = multer({
  storage: csvStorage,
  fileFilter: csvFileFilter,
  limits: {
    fileSize: Number(process.env.MAX_CSV_FILE_SIZE) || 2 * 1024 * 1024,
    files: Number(process.env.MAX_CSV_FILES) || 30,
  },
});
