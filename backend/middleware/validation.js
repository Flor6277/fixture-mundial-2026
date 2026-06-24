const { body, validationResult } = require('express-validator');

const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ error: 'Datos inválidos', details: errors.array() });
  }
  next();
};

const matchResultValidation = [
  body('home_score')
    .exists().withMessage('Debe cargar goles del local')
    .isInt({ min: 0 }).withMessage('Los goles del local deben ser enteros no negativos')
    .toInt(),
  body('away_score')
    .exists().withMessage('Debe cargar goles del visitante')
    .isInt({ min: 0 }).withMessage('Los goles del visitante deben ser enteros no negativos')
    .toInt(),
  body('home_penalties')
    .optional({ nullable: true })
    .isInt({ min: 0 }).withMessage('Los penales del local deben ser enteros no negativos')
    .toInt(),
  body('away_penalties')
    .optional({ nullable: true })
    .isInt({ min: 0 }).withMessage('Los penales del visitante deben ser enteros no negativos')
    .toInt(),
  body('reason')
    .optional({ nullable: true })
    .isString()
    .trim(),
  validate
];

module.exports = { matchResultValidation, validate };
