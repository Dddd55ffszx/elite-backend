const fs = require('fs');
const path = require('path');
const Project = require('../models/Project');
const Apartment = require('../models/Apartment');

// Upload file to project
exports.uploadProjectFile = async (req, res) => {
  try {
    const { projectId } = req.params;
    
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const project = await Project.findById(projectId);
    if (!project) {
      if (req.file && fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }
      return res.status(404).json({ error: 'Project not found' });
    }

    const fileData = {
      filename: req.file.filename,
      originalName: req.file.originalname,
      path: req.file.path,
      size: req.file.size,
      mimeType: req.file.mimetype,
      uploadedAt: new Date(),
      uploadedBy: req.userId
    };

    if (!project.files) {
      project.files = [];
    }
    
    project.files.push(fileData);
    await project.save();

    res.status(200).json({
      message: 'File uploaded successfully',
      files: project.files
    });
  } catch (error) {
    console.error('Upload error:', error);
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    res.status(500).json({ error: error.message });
  }
};

// Upload file to apartment
exports.uploadApartmentFile = async (req, res) => {
  try {
    const { apartmentId } = req.params;
    
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const apartment = await Apartment.findById(apartmentId);
    if (!apartment) {
      if (req.file && fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }
      return res.status(404).json({ error: 'Apartment not found' });
    }

    const fileData = {
      filename: req.file.filename,
      originalName: req.file.originalname,
      path: req.file.path,
      size: req.file.size,
      mimeType: req.file.mimetype,
      uploadedAt: new Date(),
      uploadedBy: req.userId
    };

    if (!apartment.files) {
      apartment.files = [];
    }
    
    apartment.files.push(fileData);
    await apartment.save();

    res.status(200).json({
      message: 'File uploaded successfully',
      files: apartment.files
    });
  } catch (error) {
    console.error('Upload error:', error);
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    res.status(500).json({ error: error.message });
  }
};

// Delete file from project
exports.deleteProjectFile = async (req, res) => {
  try {
    const { projectId, fileId } = req.params;

    const project = await Project.findById(projectId);
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    const file = project.files.id(fileId);
    if (!file) {
      return res.status(404).json({ error: 'File not found' });
    }

    if (fs.existsSync(file.path)) {
      fs.unlinkSync(file.path);
    }

    project.files.pull(fileId);
    await project.save();

    res.json({ 
      message: 'File deleted successfully',
      files: project.files 
    });
  } catch (error) {
    console.error('Delete error:', error);
    res.status(500).json({ error: error.message });
  }
};

// Delete file from apartment
exports.deleteApartmentFile = async (req, res) => {
  try {
    const { apartmentId, fileId } = req.params;

    const apartment = await Apartment.findById(apartmentId);
    if (!apartment) {
      return res.status(404).json({ error: 'Apartment not found' });
    }

    const file = apartment.files.id(fileId);
    if (!file) {
      return res.status(404).json({ error: 'File not found' });
    }

    if (fs.existsSync(file.path)) {
      fs.unlinkSync(file.path);
    }

    apartment.files.pull(fileId);
    await apartment.save();

    res.json({ 
      message: 'File deleted successfully',
      files: apartment.files 
    });
  } catch (error) {
    console.error('Delete error:', error);
    res.status(500).json({ error: error.message });
  }
};

// Get all files for a project
exports.getProjectFiles = async (req, res) => {
  try {
    const { projectId } = req.params;
    
    const project = await Project.findById(projectId).select('files');
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    res.json({ 
      files: project.files || [] 
    });
  } catch (error) {
    console.error('Error fetching files:', error);
    res.status(500).json({ error: error.message });
  }
};

// Get all files for an apartment
exports.getApartmentFiles = async (req, res) => {
  try {
    const { apartmentId } = req.params;
    
    const apartment = await Apartment.findById(apartmentId).select('files');
    if (!apartment) {
      return res.status(404).json({ error: 'Apartment not found' });
    }

    res.json({ 
      files: apartment.files || [] 
    });
  } catch (error) {
    console.error('Error fetching files:', error);
    res.status(500).json({ error: error.message });
  }
};