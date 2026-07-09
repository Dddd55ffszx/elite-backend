const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const upload = require('../middleware/upload');
const {
  uploadProjectFile,
  uploadApartmentFile,
  deleteProjectFile,
  deleteApartmentFile,
  getProjectFiles,
  getApartmentFiles
} = require('../controllers/uploadController');

// ================= PROJECT FILE ROUTES =================
router.get('/project/:projectId', auth, getProjectFiles);
router.post('/project/:projectId', auth, upload.single('file'), uploadProjectFile);
router.delete('/project/:projectId/:fileId', auth, deleteProjectFile);

// ================= APARTMENT FILE ROUTES =================
router.get('/apartment/:apartmentId', auth, getApartmentFiles);
router.post('/apartment/:apartmentId', auth, upload.single('file'), uploadApartmentFile);
router.delete('/apartment/:apartmentId/:fileId', auth, deleteApartmentFile);

module.exports = router;