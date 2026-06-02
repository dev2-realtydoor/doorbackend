const { success, created } = require('../../utils/ApiResponse');
const service = require('./locality.service');

async function getLocality(req, res, next) {
  try {
    const { city, locality } = req.query;
    const insight = await service.getLocality(city, locality);
    success(res, insight);
  } catch (err) { next(err); }
}

async function upsertLocality(req, res, next) {
  try {
    const insight = await service.upsertLocality(req.body, req.user.id);
    created(res, insight, 'Locality insight saved');
  } catch (err) { next(err); }
}

async function deleteLocality(req, res, next) {
  try {
    await service.deleteLocality(req.params.id);
    success(res, null, 'Locality insight deleted');
  } catch (err) { next(err); }
}

module.exports = { getLocality, upsertLocality, deleteLocality };
