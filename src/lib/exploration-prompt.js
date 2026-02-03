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
   - key_variables_dict: {变量名: 变量值}，用于展示中间计算过程
   - **重要：key_variables_dict中的变量值优先返回pd.Series类型（带时间索引），不得已的情况下才返回np.ndarray**
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

## 伪代码格式要求

伪代码必须详细描述计算流程，包含以下要素：

### 1. 阶段划分
使用【xxx阶段】明确标注各个计算阶段，例如：
- 【数据读取阶段】
- 【数据预处理阶段】
- 【特征计算阶段】
- 【因子合成阶段】
- 【结果输出阶段】

### 2. 步骤详细说明
每个步骤必须包含：
- 步骤序号和标题
- 使用的数据字段（明确列出字段名）
- 计算公式或逻辑（使用伪代码语法）
- 中间变量命名

### 3. 数据字段标注
- 读取数据时必须注明使用的具体字段
- 字段名使用反引号标注，如 \`price\`, \`volume\`
- 注明字段来源（逐笔成交/盘口快照）

### 4. 示例格式
\`\`\`
【数据读取阶段】
1. 读取逐笔成交数据 (read_trade)
   - 使用字段: \`price\`(成交价格), \`volume\`(成交量), \`flag\`(买卖标志)
   - 数据筛选: 排除撤单(flag=32)，保留主买(flag=66)和主卖(flag=83)

2. 读取盘口快照数据 (read_market)  
   - 使用字段: \`bid_vol1\`(买一量), \`ask_vol1\`(卖一量), \`last_prc\`(最新价)

【数据预处理阶段】
3. 时间对齐处理
   - 对trade_data和market_data应用adjust_afternoon调整下午时间

4. 计算中间价格序列
   - mid_price = (\`ask_prc1\` + \`bid_prc1\`) / 2

【因子计算阶段】
5. 计算买卖压力指标
   - buy_pressure = sum(\`volume\` * flag_is_buy) / sum(\`volume\`)
   - 其中flag_is_buy = (\`flag\` == 66)

6. 计算盘口不平衡度
   - imbalance = (\`bid_vol1\` - \`ask_vol1\`) / (\`bid_vol1\` + \`ask_vol1\`)

【结果输出阶段】
7. 返回结果
   - factor_dict: {'buy_pressure': buy_pressure, 'imbalance': imbalance}
   - key_variables_dict: {'mid_price': mid_price}
\`\`\`

请返回JSON格式（严格遵守以下要求）：
1. 必须是合法的JSON格式，可以被JSON.parse直接解析
2. **pseudocode字段必须使用普通双引号字符串，所有换行使用\\n转义，绝对不能使用三引号"""**
3. 不要包含markdown代码块标记

返回格式示例：
{
  "variants": [
    {
      "name": "方案1名称",
      "description": "方案描述...",
      "pseudocode": "【数据读取阶段】\\n1. 读取逐笔成交数据\\n   - 使用字段: \`price\`, \`volume\`\\n【因子计算阶段】\\n2. 计算VWAP\\n   - vwap = sum(\`price\` * \`volume\`) / sum(\`volume\`)\\n【结果输出阶段】\\n3. 返回 {'vwap': vwap}",
      "code": "import pandas as pd\\ndef calculate_factor(code, date):\\n    ..."
    }
  ]
}
`
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
            pseudocode: `【数据读取阶段】
1. 读取逐笔成交数据 (read_trade)
   - 使用字段: \`price\`(成交价格), \`volume\`(成交量), \`flag\`(买卖标志)
   - 数据筛选: 排除撤单(flag=32)，保留主买(flag=66)和主卖(flag=83)

2. 读取盘口快照数据 (read_market)
   - 使用字段: \`bid_vol1\`(买一量), \`ask_vol1\`(卖一量), \`last_prc\`(最新价)

【数据预处理阶段】
3. 时间对齐处理
   - 对trade_data和market_data应用adjust_afternoon调整下午时间
   - 检查数据是否为空，空数据返回默认值

【因子计算阶段】
4. 计算成交量加权平均价(VWAP)
   - 公式: vwap = sum(\`price\` * \`volume\`) / sum(\`volume\`)
   - 使用全天的逐笔成交数据计算

【结果输出阶段】
5. 返回结果
   - factor_dict: {'vwap': vwap}
   - key_variables_dict: {'prices': trade_data['price']}`,
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
            pseudocode: `【数据读取阶段】
1. 读取逐笔成交数据 (read_trade)
   - 使用字段: \`exchtime\`(交易时间), \`price\`(成交价格), \`volume\`(成交量)

【数据预处理阶段】
2. 时间对齐处理
   - 对trade_data应用adjust_afternoon调整下午时间
   - 检查数据是否为空，空数据返回空Series

3. 时间粒度转换
   - 将\`exchtime\`向下取整到分钟级别
   - 生成新字段'minute'表示所属分钟

【因子计算阶段】
4. 按分钟聚合成交量
   - 按'minute'字段分组
   - 对每个分组求和\`volume\`
   - 结果: volume_by_minute (时间序列)

【结果输出阶段】
5. 返回结果
   - factor_dict: {'volume_by_minute': volume_by_minute}
   - key_variables_dict: {'volume': trade_data['volume']}`,
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
            pseudocode: `【数据读取阶段】
1. 读取逐笔成交数据 (read_trade)
   - 用于数据完整性检查

2. 读取盘口快照数据 (read_market)
   - 使用字段: \`bid_vol1\`(买一量), \`ask_vol1\`(卖一量)

【数据预处理阶段】
3. 时间对齐处理
   - 对market_data应用adjust_afternoon调整下午时间
   - 检查数据是否为空，空数据返回默认值

【因子计算阶段】
4. 计算买卖盘总量
   - bid_vol_sum = sum(\`bid_vol1\`)  # 买一量全天总和
   - ask_vol_sum = sum(\`ask_vol1\`)  # 卖一量全天总和

5. 计算买卖不平衡度
   - 公式: imbalance = (bid_vol_sum - ask_vol_sum) / (bid_vol_sum + ask_vol_sum)
   - 处理分母为0的情况: 如果总和为0，imbalance = 0

【结果输出阶段】
6. 返回结果
   - factor_dict: {'imbalance': imbalance}
   - key_variables_dict: {'bid_vol': market_data['bid_vol1'], 'ask_vol': market_data['ask_vol1']}`,
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

/**
 * 获取根据说明生成代码的prompt
 * @param {string} description - 方案说明
 * @param {string} pseudocode - 伪代码
 * @param {string} currentCode - 当前代码（可选，用于参考）
 * @param {string|null} pseudocodeDiff - 伪代码的diff（可选，用于精确定位修改）
 * @returns {string} prompt
 */
export function getGenerateCodeFromDescriptionPrompt(description, pseudocode, currentCode = '', pseudocodeDiff = null) {
    const currentCodeHint = currentCode ? `
当前代码（供参考，不需要完全遵循）：
\`\`\`python
${currentCode}
\`\`\`
` : '';

    // 如果有diff，使用diff-focused的提示词
    if (pseudocodeDiff) {
        return `你是一位专业的量化研究员。请根据以下伪代码的修改（diff），对当前代码进行对应的精准修改。

## 修改说明
用户修改了方案说明和伪代码，以下是具体的变更内容：

**伪代码变更（diff格式，+表示新增，-表示删除）：**
\`\`\`
${pseudocodeDiff}
\`\`\`

**当前伪代码（修改后）：**
\`\`\`
${pseudocode}
\`\`\`

**方案说明：**
${description}

${currentCodeHint}
## 修改要求
1. **只修改与伪代码变更相关的代码部分**，未变更的部分保持原有实现不变
2. **重点关注diff中的变更**：
   - 对于新增(+)的行，在代码中添加对应的实现
   - 对于删除(-)的行，在代码中移除对应的逻辑
3. **函数定义必须是 def calculate_factor(code, date):，绝对不要使用其他函数名**
4. **函数必须返回一个元组 tuple: (factor_dict, key_variables_dict)**
   - factor_dict: {因子名: 因子值}，因子值可以是标量(float/int)或时间序列(pd.Series)
   - key_variables_dict: {变量名: 变量值}，用于展示中间计算过程
   - **重要：key_variables_dict中的变量值优先返回pd.Series类型（带时间索引），不得已的情况下才返回np.ndarray**
5. 代码必须完整可执行，包含所有必要的import语句
6. 添加必要的错误处理（如空数据检查）
7. 代码要简洁高效，避免过于复杂的计算

## 重要提示
- 这是一个**增量修改**任务，不是重写
- 保持原有代码的结构和风格
- 只修改与伪代码变更相关的部分
- 如果伪代码变更涉及新的计算逻辑，确保正确实现

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
\`\`\`

请只返回完整的Python代码字符串（不要包含markdown代码块标记）：`;
    }

    // 没有diff时的默认提示词
    return `你是一位专业的量化研究员。请根据以下方案说明和伪代码，生成完整的、可执行的Python代码。

方案说明：
${description}

计算流程伪代码：
\`\`\`
${pseudocode}
\`\`\`
${currentCodeHint}
要求：
1. **函数定义必须是 def calculate_factor(code, date):，绝对不要使用其他函数名**
2. **函数必须返回一个元组 tuple: (factor_dict, key_variables_dict)**
   - factor_dict: {因子名: 因子值}，因子值可以是标量(float/int)或时间序列(pd.Series)
   - key_variables_dict: {变量名: 变量值}，用于展示中间计算过程
   - **重要：key_variables_dict中的变量值优先返回pd.Series类型（带时间索引），不得已的情况下才返回np.ndarray**
3. 代码必须完整可执行，包含所有必要的import语句
4. 代码逻辑应该严格遵循伪代码描述的计算流程
5. 添加必要的错误处理（如空数据检查）
6. 代码要简洁高效，避免过于复杂的计算

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
\`\`\`

请只返回完整的Python代码字符串（不要包含markdown代码块标记）：`;
}
