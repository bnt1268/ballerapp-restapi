const Sequelize = require("sequelize");
const db = require("../../../../config/db-mysql");
const asyncHandler = require("../../../middleware/asyncHandler");
const paginate = require("../../../utils/paginate");

const Op = Sequelize.Op;

exports.getDeletedSportHalls = asyncHandler(async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const sort = req.query.sort;
  let select = req.query.select;
  let search = req.query.search;
  if (select) {
    select = select.split(" ");
  }

  ["select", "sort", "page", "limit"].forEach((el) => delete req.query[el]);

  const pagination = await paginate(page, limit, req.db.sportHall);

  let query = {
    offset: pagination.start - 1,
    limit,
    include: [
      {
        model: db.tagSportHall,
        attributes: ["tagId", "tagName", "createdAt", "updatedAt"],
        through: { attributes: [] },
      },
    ],
  };

  if (req.query) {
    query.where = {
      [Op.and]: [
        { status: "deleted" },
        { title: { [Op.like]: `%${req.query.search}%` } },
        req.query.select,
      ],
    };
  }

  if (req.query) {
    query.where = req.query;
  }

  if (select) {
    query.attributes = select;
  }

  if (sort) {
    query.order = sort
      .split(" ")
      .map((el) => [
        el.charAt(0) === "-" ? el.substring(1) : el,
        el.charAt(0) === "-" ? "DESC" : "ASC",
      ]);
  }

  const allSportHalls = await req.db.sportHall.findAll({
    where: { status: "deleted" },
  });
  let count;
  let pages;
  for (var i = 0; i < allSportHalls.length; i++) {
    count = i + 1;
    pages = Math.ceil((i + 1) / limit);
  }

  const sportHalls = await req.db.sportHall.findAll(query);

  res.status(200).json({
    success: true,
    count,
    pages,
    message: "Амжилттай",
    sportHalls,
  });
});