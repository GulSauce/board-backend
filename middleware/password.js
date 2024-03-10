import * as validation from '#utility/validation'

export const validatePassword = (req, res, next) => {
  const { password } = req.body

  validation.check(
    password,
    'password',
    validation.checkExist(),
    validation.checkLength(1, 100),
  )

  next()
}
