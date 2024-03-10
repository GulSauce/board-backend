import * as validation from '#utility/validation'

export const validateArticle = (req, res, next) => {
  const { nickname, title, content } = req.body

  validation.check(
    nickname,
    'nickname',
    validation.checkExist(),
    validation.checkLength(1, 100),
  )

  validation.check(
    title,
    'title',
    validation.checkExist(),
    validation.checkRegExp(/^[a-zA-Z0-9가-힣 -~]{1,100}/),
  )
  validation.check(content, 'content', validation.checkExist())

  next()
}

export const validateArticlePathIndex = (req, res, next) => {
  const { articleId } = req.params

  validation.check(
    articleId,
    'articleId',
    validation.checkExist(),
    validation.checkParsedNumberInRange(1, Infinity),
  )

  next()
}
