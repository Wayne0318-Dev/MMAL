export const PARSING_RULES = [
  "每个工作表是一天，表内分 A班 / B班。",
  "查询只认机台编号和模具编号的关联；机种品名只作备注。",
  "机台列有值：该行机台。机台列空白：继承本班次上一行机台。",
  "上 = 上机，下 = 下机。没有勾选也不影响关联。",
  "前模/后模是同一套模的两半。主编号相同即同一套模；下后模再上是半边维修。",
  "一格里多个不同模号 = 多套模，都关联到这一台。M2 展开为 C0151-149M2。",
  "S240127AB 记作 S240127。S26008 按确认改为 S250137。Meridian支架缺号补 ZDX3464。",
  "只列出实际出现过的机台，不按字母组联想其他机台。",
  "新的转模表按文件累加。同名文件再导入会替换该文件旧数据，不会把同一月加两遍。",
];

export const QUESTIONS = [
  {
    id: "Q1",
    status: "confirmed" as const,
    title: "上 / 下 的含义",
    answer: "对。上 = 上机，下 = 下机。",
  },
  {
    id: "Q2",
    status: "confirmed" as const,
    title: "空白机台是否继承上一行",
    answer: "对。同一班次内，机台格空白的行属于上一行机台。",
  },
  {
    id: "Q3",
    status: "confirmed" as const,
    title: "前模 / 后模",
    answer:
      "一套模分成前模、后模，合起来才是完整模具。上机后若后模异常，只下后模保养或维修，好了再上。查询按主编号，前/后只表示这次动的是哪一半。",
  },
  {
    id: "Q4",
    status: "confirmed" as const,
    title: "历史装机是否可查",
    answer: "可以。用各月表里实际出现过的机台作为查询结果。",
  },
  {
    id: "Q5",
    status: "confirmed" as const,
    title: "字母段是否要联想同组机台",
    answer:
      "不是。A/B/C/D/E 只是机台编号分组。只给实际出现过的机台号，不做同组联想。",
  },
  {
    id: "Q6",
    status: "confirmed" as const,
    title: "S250188 出现在 B09 和 D03",
    answer:
      "没有问题。9月10日 B09：下 S260009、上 S250188；D03：下 S250162、上 S250188。品名不同不影响。S250188 同时关联 B09 和 D03。",
  },
  {
    id: "Q7",
    status: "confirmed" as const,
    title: "Meridian支架缺号",
    answer: "模具编号就是 ZDX3464，9月13日 C05 那条按同一副模补号。",
  },
  {
    id: "Q8",
    status: "confirmed" as const,
    title: "Remo触屏支架编号",
    answer:
      "Remo触屏支架模具编号是 S250137。表里写成 S26008 的那条已改归 S250137。",
  },
  {
    id: "Q9",
    status: "confirmed" as const,
    title: "一格多个模号",
    answer: "模号不同就是两套模，都关联到该机台。M2 即 C0151-149M2。",
  },
  {
    id: "Q10",
    status: "confirmed" as const,
    title: "ZDX3312 两个品名",
    answer: "同模不同镶件，记录都是同一套模。",
  },
  {
    id: "Q11",
    status: "confirmed" as const,
    title: "S240217 的品名",
    answer: "是 EX1H。品名只作备注，关联仍按模具号。",
  },
  {
    id: "Q12",
    status: "confirmed" as const,
    title: "未勾选上/下",
    answer: "上下勾选非必要。必要的是机台编号和模具号是否关联。",
  },
  {
    id: "Q13",
    status: "confirmed" as const,
    title: "试模 / 机种名",
    answer: "机种名非关键信息。只要机台编号和模具号关联即可。",
  },
  {
    id: "Q14",
    status: "confirmed" as const,
    title: "S240127AB",
    answer: "不用拆。记同一主编号 S240127。",
  },
];
