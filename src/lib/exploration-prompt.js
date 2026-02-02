/**
 * 获取探索方案生成的提示词
 * @param {string} commentContent - 评论内容
 * @param {boolean} isRegenerate - 是否为重新生成
 * @returns {string} 提示词
 */
export function getExplorationPrompt(commentContent, isRegenerate = false) {
    const regenerateHint = isRegenerate ? `
重要提示：这是重新生成请求，请提供与之前不同的、更具创新性的实现方案。尝试：
1. 从不同角度理解因子描述
2. 使用不同的数学方法或统计技术
3. 考虑不同的市场微观结构特征
` : '';

    return `你是一位专业的量化研究员。请根据以下因子构造描述，生成3种不同的Python代码实现方案。

因子描述：
${commentContent}

**关键要求：你必须根据因子描述实现完整的因子计算逻辑，不能留空或只写TODO注释。代码必须能够实际运行并返回有意义的计算结果。**
${regenerateHint}
要求：
1. 每种方案应该是对因子描述的不同理解或不同实现角度
2. **函数定义必须是 def calculate_factor(code, date):，绝对不要使用其他函数名如 calculate_xxx 等**
3. **函数必须返回一个元组 tuple: (factor_dict, key_variables_dict)**
   - factor_dict: {因子名: 因子值}，因子值可以是标量(float/int)或时间序列(pd.Series)
   - key_variables_dict: {变量名: 变量值}，用于展示中间计算过程，变量值可以是标量或时间序列
4. 代码中需要包含关键中间变量的注释
5. 代码要简洁高效，避免过于复杂的计算
6. **必须实现具体的因子计算逻辑，不能只是占位符**
7. **示例返回格式（必须严格遵守）**：
   \`\`\`
   def calculate_factor(code, date):
       # ... 计算逻辑 ...
       factor_dict = {'reversal_factor': factor_value, 'momentum_factor': momentum}
       key_variables_dict = {'mid_prices': mid_prices, 'ofi': ofi_series}
       return factor_dict, key_variables_dict
   \`\`\`
   
8. **关于因子值的类型**：
   - 如果因子计算结果是一个字典（包含多个子指标），应该将整个字典作为单个因子值返回
   - 例如：factor_dict = {'ofi_reversal': {'ofi_persistence': 0.5, 'liquidity_score': 0.3, 'informed_ratio': 0.7}}
   - 前端会用表格形式展示字典类型的因子值

### 1. 读取逐笔成交数据
\`\`\`python
def read_trade(symbol:str, date:int, with_retreat:int=0)->pd.DataFrame:
    file_name = "%s_%d_%s.csv" % (symbol, date, "transaction")
    file_path = os.path.join("/ssd_data/stock", str(date), "transaction", file_name)
    df= pd.read_csv(
        file_path,
        dtype={"symbol": str},
        usecols=[
            "exchtime",
            "price",
            "volume",
            "turnover",
            "flag",
            "index",
            "localtime",
            "ask_order",
            "bid_order",
        ],
        memory_map=True,
        engine="c",
        low_memory=False,
    )
    if not with_retreat:
        df=df[df.flag!=32]
    df.exchtime=pd.to_timedelta(df.exchtime/1e6,unit='s')+pd.Timestamp('1970-01-01 08:00:00')
    return df

# 参数说明：
# - symbol: 股票代码，格式为字符串，如 '000001', '600000'
# - date: 交易日期，格式为整数，如 20220819
# - with_retreat: 是否包含撤单(32)，默认0表示排除撤单
\`\`\`

### 2. 读取盘口快照数据
\`\`\`python
def read_market(symbol:str, date:int)->pd.DataFrame:
    file_name = "%s_%d_%s.csv" % (symbol, date, "market_data")
    file_path = os.path.join("/ssd_data/stock", str(date), "market_data", file_name)
    df= pd.read_csv(
        file_path,
        dtype={"symbol": str},
        memory_map=True,
        engine="c",
        low_memory=False,
    )
    df.exchtime=pd.to_timedelta(df.exchtime/1e6,unit='s')+pd.Timestamp('1970-01-01 08:00:00')
    return df

# 参数说明：
# - symbol: 股票代码，格式为字符串，如 '000001', '600000'
# - date: 交易日期，格式为整数，如 20220819
\`\`\`

### 3. 读取买卖盘pair数据（将10档买卖盘转为长格式）
\`\`\`python
def read_market_pair(symbol:str, date:int)->tuple[pd.DataFrame,pd.DataFrame]:
    df=read_market(symbol,date)
    df = df[df.last_prc != 0]
    ask_prc_cols = [f"ask_prc{i}" for i in range(1, 11)]
    ask_vol_cols = [f"ask_vol{i}" for i in range(1, 11)]
    asks = pd.concat(
        [
            pd.melt(
                df[ask_prc_cols + ["exchtime"]],
                id_vars=["exchtime"],
                value_name="price",
            )
            .rename(columns={"variable": "number"})
            .set_index("exchtime"),
            pd.melt(
                df[ask_vol_cols + ["exchtime"]],
                id_vars=["exchtime"],
                value_name="vol",
            )
            .drop(columns=["variable"])
            .set_index("exchtime"),
        ],
        axis=1,
    )
    asks=asks[asks.price!=0]
    asks.number=asks.number.str.slice(7).astype(int)
    asks=asks.reset_index().sort_values(by=["exchtime", "number"]).reset_index(drop=True)

    bid_prc_cols = [f"bid_prc{i}" for i in range(1, 11)]
    bid_vol_cols = [f"bid_vol{i}" for i in range(1, 11)]
    bids = pd.concat(
        [
            pd.melt(
                df[bid_prc_cols + ["exchtime"]],
                id_vars=["exchtime"],
                value_name="price",
            )
            .rename(columns={"variable": "number"})
            .set_index("exchtime"),
            pd.melt(
                df[bid_vol_cols + ["exchtime"]],
                id_vars=["exchtime"],
                value_name="vol",
            )
            .drop(columns=["variable"])
            .set_index("exchtime"),
        ],
        axis=1,
    )
    bids=bids[bids.price!=0]
    bids.number=bids.number.str.slice(7).astype(int)
    bids=bids.reset_index().sort_values(by=["exchtime", "number"]).reset_index(drop=True)
    return asks, bids
\`\`\`

## 数据结构说明

### 逐笔成交数据字段 (Trade Data)
- \`exchtime\`: 交易时间 (pd.Timestamp)
- \`price\`: 成交价格 (float64)
- \`volume\`: 成交量 (int64)
- \`turnover\`: 成交金额 (float64)
- \`flag\`: 交易标志 (int32)
  - 66 = 主买
  - 83 = 主卖
  - 32 = 撤单
- \`ask_order\`: 卖单订单编号 (int64)
- \`bid_order\`: 买单订单编号 (int64)

### 盘口快照数据字段 (Market Data)
- \`symbol\`: 股票代码
- \`exchtime\`: 时间戳 (pd.Timestamp)
- \`last_prc\`: 最新价格
- \`prev_close\`: 昨收价
- \`open\`: 开盘价
- \`high\`: 最高价
- \`low\`: 最低价
- \`high_limited\`: 涨停价
- \`low_limited\`: 跌停价
- \`volume\`: 成交量
- \`turnover\`: 成交金额
- \`num_trades\`: 成交笔数
- \`ask_prc1-10\`: 卖价1-10档
- \`ask_vol1-10\`: 卖量1-10档
- \`bid_prc1-10\`: 买价1-10档
- \`bid_vol1-10\`: 买量1-10档
- \`weighted_ask_prc\`: 加权卖价
- \`weighted_bid_prc\`: 加权买价

## 重要提示
1. **日期格式**：必须使用8位整数格式，如20220819表示2022年8月19日
2. **股票代码**：使用6位字符串格式，如'000001'（深市）或'600000'（沪市）
3. **时间格式**：所有时间字段均为datetime64[ns]格式，便于pandas时间序列分析
4. **必须实现因子计算**：代码中必须包含具体的因子计算逻辑，返回实际的计算结果，不能只是TODO注释

请返回JSON格式（不要包含markdown代码块标记）：
{
  "variants": [
    {
      "name": "方案1名称（简洁描述核心思路）",
      "description": "该方案的核心思路和特点",
      "code": "Python代码字符串，包含完整的函数定义"
    },
    {
      "name": "方案2名称",
      "description": "该方案的核心思路和特点",
      "code": "Python代码字符串"
    },
    {
      "name": "方案3名称",
      "description": "该方案的核心思路和特点",
      "code": "Python代码字符串"
    }
  ]
}`;
}

/**
 * 获取默认方案
 * @returns {Array} 默认方案数组
 */
export function getDefaultVariants() {
    return [
        {
            name: "基础实现方案",
            description: "基于描述的直接实现，使用最直观的方法",
            code: `import pure_ocean_breeze.jason as p
import pandas as pd
import numpy as np

def calculate_factor(code, date):
    trade_data = p.adjust_afternoon(p.read_trade(code, date))
    market_data = p.adjust_afternoon(p.read_market(code, date))

    # 示例：计算成交量加权平均价
    if len(trade_data) == 0:
        return {'vwap': 0}, {}

    vwap = (trade_data['price'] * trade_data['volume']).sum() / trade_data['volume'].sum()
    return {'vwap': vwap}, {'prices': trade_data['price']}`
        },
        {
            name: "时间序列方案",
            description: "将因子计算为时间序列，保留更多细节信息",
            code: `import pure_ocean_breeze.jason as p
import pandas as pd
import numpy as np

def calculate_factor(code, date):
    trade_data = p.adjust_afternoon(p.read_trade(code, date))
    market_data = p.adjust_afternoon(p.read_market(code, date))

    # 示例：按分钟聚合成交量
    if len(trade_data) == 0:
        return {'volume_by_minute': pd.Series()}, {}

    trade_data['minute'] = trade_data['exchtime'].dt.floor('min')
    volume_by_minute = trade_data.groupby('minute')['volume'].sum()
    return {'volume_by_minute': volume_by_minute}, {'volume': trade_data['volume']}`
        },
        {
            name: "盘口特征方案",
            description: "基于盘口快照数据计算因子",
            code: `import pure_ocean_breeze.jason as p
import pandas as pd
import numpy as np

def calculate_factor(code, date):
    trade_data = p.adjust_afternoon(p.read_trade(code, date))
    market_data = p.adjust_afternoon(p.read_market(code, date))

    # 示例：计算买卖盘不平衡度
    if len(market_data) == 0:
        return {'imbalance': 0}, {}

    bid_vol = market_data['bid_vol1'].sum()
    ask_vol = market_data['ask_vol1'].sum()
    imbalance = (bid_vol - ask_vol) / (bid_vol + ask_vol) if (bid_vol + ask_vol) > 0 else 0
    return {'imbalance': imbalance}, {'bid_vol': market_data['bid_vol1'], 'ask_vol': market_data['ask_vol1']}`
        }
    ];
}
