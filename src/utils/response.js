// Единый формат ответов API: списки отдаём с блоком meta, одиночные сущности —
// в обёртке data, чтобы клиент всегда знал, где искать полезную нагрузку.
export function sendList(res, { data, total }, page, limit) {
  res.json({
    data,
    meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
  });
}

export function sendOne(res, data) {
  res.json({ data });
}
