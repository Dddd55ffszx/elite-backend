
const router = require('express').Router();
const auth = require('../middleware/auth');
const roles = require('../middleware/roles');
const Client = require('../models/Client');


router.post('/', auth, roles('admin','sales'), async (req,res) => {
  const client = await Client.create(req.body);
  res.json(client);
});


router.get('/', auth, roles('admin','sales','accountant'), async (req,res) => {
  const clients = await Client.find().sort({ createdAt:-1 });
  res.json(clients);
});


router.get('/:id', auth, async (req,res) => {
  const client = await Client.findById(req.params.id);
  res.json(client);
});


router.put('/:id', auth, roles('admin','sales'), async (req,res) => {
  const updated = await Client.findByIdAndUpdate(req.params.id, req.body, { new:true });
  res.json(updated);
});

router.delete('/:id', auth, roles('admin'), async (req,res) => {
  await Client.findByIdAndDelete(req.params.id);
  res.json({ ok:true });
});

module.exports = router;
