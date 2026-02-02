import { spawn } from 'child_process';
import { writeFile, unlink } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import { randomBytes } from 'crypto';

/**
 * 执行Python代码并返回结果
 * @param {string} code - Python代码
 * @param {string} stockCode - 股票代码
 * @param {number} date - 日期
 * @returns {Promise<Object>} 执行结果
 */
export async function executePythonCode(code, stockCode, date) {
    // 创建临时Python文件
    const tmpFile = join(tmpdir(), `explore_${randomBytes(8).toString('hex')}.py`);

    // 包装用户代码，添加数据读取和结果输出
    const wrappedCode = `
import sys
import json
import traceback

# 设置超时
import signal

def timeout_handler(signum, frame):
    raise TimeoutError("代码执行超时（60秒）")

signal.signal(signal.SIGALRM, timeout_handler)
signal.alarm(60)  # 60秒超时

try:
    import pandas as pd
    import numpy as np
    import os

    # 预定义的数据读取函数
    def read_trade(symbol, date, with_retreat=0):
        file_name = "%s_%d_%s.csv" % (symbol, date, "transaction")
        file_path = os.path.join("/ssd_data/stock", str(date), "transaction", file_name)
        df = pd.read_csv(
            file_path,
            dtype={"symbol": str},
            usecols=["exchtime", "price", "volume", "turnover", "flag", "index", "localtime", "ask_order", "bid_order"],
            memory_map=True,
            engine="c",
            low_memory=False,
        )
        if not with_retreat:
            df = df[df.flag != 32]
        df.exchtime = pd.to_timedelta(df.exchtime / 1e6, unit='s') + pd.Timestamp('1970-01-01 08:00:00')
        return df

    def read_market(symbol, date):
        file_name = "%s_%d_%s.csv" % (symbol, date, "market_data")
        file_path = os.path.join("/ssd_data/stock", str(date), "market_data", file_name)
        df = pd.read_csv(
            file_path,
            dtype={"symbol": str},
            memory_map=True,
            engine="c",
            low_memory=False,
        )
        df.exchtime = pd.to_timedelta(df.exchtime / 1e6, unit='s') + pd.Timestamp('1970-01-01 08:00:00')
        return df

    def read_market_pair(symbol, date):
        df = read_market(symbol, date)
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
        asks = asks[asks.price != 0]
        asks.number = asks.number.str.slice(7).astype(int)
        asks = asks.reset_index().sort_values(by=["exchtime", "number"]).reset_index(drop=True)

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
        bids = bids[bids.price != 0]
        bids.number = bids.number.str.slice(7).astype(int)
        bids = bids.reset_index().sort_values(by=["exchtime", "number"]).reset_index(drop=True)
        return asks, bids

    # 用户代码
${code.split('\n').map(line => '    ' + line).join('\n')}

    # 执行函数
    result = calculate_factor('${stockCode}', ${date})

    # 处理结果 - 期望返回 (factor_dict, key_variables_dict)
    output = {
        'type': 'tuple',
        'value': None,
        'plotlyData': None,
        'keyVariables': {},
        'factors': {},
        'finalResult': None
    }

    # 解析返回的元组
    factor_dict = {}
    key_variables_dict = {}

    if isinstance(result, tuple) and len(result) == 2:
        factor_dict, key_variables_dict = result
    elif isinstance(result, dict):
        # 兼容旧格式，如果只返回字典，认为是factor_dict
        factor_dict = result
    else:
        # 其他情况，包装成字典
        factor_dict = {'result': result}

    # 处理因子字典
    if isinstance(factor_dict, dict):
        for factor_name, factor_value in factor_dict.items():
            if isinstance(factor_value, pd.Series):
                output['factors'][factor_name] = {
                    'type': 'Series',
                    'stats': {
                        'mean': float(factor_value.mean()) if not pd.isna(factor_value.mean()) else None,
                        'std': float(factor_value.std()) if not pd.isna(factor_value.std()) else None,
                        'min': float(factor_value.min()) if not pd.isna(factor_value.min()) else None,
                        'max': float(factor_value.max()) if not pd.isna(factor_value.max()) else None,
                        'count': int(factor_value.count())
                    },
                    'data': {
                        'x': factor_value.index.astype(str).tolist(),
                        'y': [None if pd.isna(v) else float(v) for v in factor_value.values]
                    }
                }
            elif isinstance(factor_value, dict):
                # 字典类型因子值（包含多个子指标）
                output['factors'][factor_name] = {
                    'type': 'Dict',
                    'value': {k: float(v) if isinstance(v, (int, float, np.number)) else v for k, v in factor_value.items()}
                }
            elif isinstance(factor_value, (int, float, np.number)):
                output['factors'][factor_name] = {
                    'type': 'Scalar',
                    'value': float(factor_value)
                }
            elif isinstance(factor_value, np.ndarray):
                output['factors'][factor_name] = {
                    'type': 'Array',
                    'stats': {
                        'mean': float(np.mean(factor_value)) if len(factor_value) > 0 else None,
                        'std': float(np.std(factor_value)) if len(factor_value) > 0 else None,
                        'min': float(np.min(factor_value)) if len(factor_value) > 0 else None,
                        'max': float(np.max(factor_value)) if len(factor_value) > 0 else None,
                        'count': len(factor_value)
                    },
                    'data': factor_value.tolist()
                }

    # 处理关键中间变量字典
    if isinstance(key_variables_dict, dict):
        for var_name, var_value in key_variables_dict.items():
            if isinstance(var_value, pd.Series):
                output['keyVariables'][var_name] = {
                    'type': 'Series',
                    'stats': {
                        'mean': float(var_value.mean()) if not pd.isna(var_value.mean()) else None,
                        'std': float(var_value.std()) if not pd.isna(var_value.std()) else None,
                        'min': float(var_value.min()) if not pd.isna(var_value.min()) else None,
                        'max': float(var_value.max()) if not pd.isna(var_value.max()) else None,
                        'count': int(var_value.count())
                    },
                    'data': {
                        'x': var_value.index.astype(str).tolist(),
                        'y': [None if pd.isna(v) else float(v) for v in var_value.values]
                    }
                }
            elif isinstance(var_value, (int, float, np.number)):
                output['keyVariables'][var_name] = {
                    'type': 'Scalar',
                    'value': float(var_value)
                }
            elif isinstance(var_value, np.ndarray):
                output['keyVariables'][var_name] = {
                    'type': 'Array',
                    'stats': {
                        'mean': float(np.mean(var_value)) if len(var_value) > 0 else None,
                        'std': float(np.std(var_value)) if len(var_value) > 0 else None,
                        'min': float(np.min(var_value)) if len(var_value) > 0 else None,
                        'max': float(np.max(var_value)) if len(var_value) > 0 else None,
                        'count': len(var_value)
                    },
                    'data': var_value.tolist()
                }

    # 为第一个因子生成Plotly图表（如果存在）
    if output['factors']:
        first_factor = list(output['factors'].keys())[0]
        first_factor_data = output['factors'][first_factor]
        if first_factor_data['type'] == 'Series':
            output['plotlyData'] = {
                'data': [{
                    'x': first_factor_data['data']['x'],
                    'y': first_factor_data['data']['y'],
                    'type': 'scatter',
                    'mode': 'lines',
                    'name': first_factor
                }],
                'layout': {
                    'title': f'因子: {first_factor}',
                    'xaxis': { 'title': '时间' },
                    'yaxis': { 'title': '值' }
                }
            }
        elif first_factor_data['type'] == 'Scalar':
            output['plotlyData'] = {
                'data': [{
                    'type': 'indicator',
                    'mode': 'number',
                    'value': first_factor_data['value'],
                    'title': { 'text': f'因子: {first_factor}' }
                }],
                'layout': { 'height': 300 }
            }

    # 输出JSON结果
    print("___RESULT_START___")
    print(json.dumps(output, default=str))
    print("___RESULT_END___")

except TimeoutError as e:
    print("___ERROR_START___")
    print(json.dumps({'error': '代码执行超时（60秒）', 'type': 'TimeoutError'}))
    print("___ERROR_END___")
    sys.exit(1)
except Exception as e:
    print("___ERROR_START___")
    error_info = {
        'error': str(e),
        'type': type(e).__name__,
        'traceback': traceback.format_exc()
    }
    print(json.dumps(error_info))
    print("___ERROR_END___")
    sys.exit(1)
`;

    try {
        await writeFile(tmpFile, wrappedCode);

        // 执行Python脚本
        const { stdout, stderr, exitCode } = await runPython(tmpFile);

        // 解析结果
        const resultMatch = stdout.match(/___RESULT_START___\n([\s\S]*?)\n___RESULT_END___/);
        const errorMatch = stdout.match(/___ERROR_START___\n([\s\S]*?)\n___ERROR_END___/);

        if (errorMatch) {
            const errorInfo = JSON.parse(errorMatch[1]);
            return {
                success: false,
                error: errorInfo.error,
                errorType: errorInfo.type,
                traceback: errorInfo.traceback,
                stdout,
                stderr
            };
        }

        if (resultMatch) {
            const output = JSON.parse(resultMatch[1]);
            return {
                success: true,
                ...output,
                stdout,
                stderr
            };
        }

        // 没有匹配到结果
        return {
            success: false,
            error: '无法解析执行结果',
            stdout,
            stderr
        };

    } finally {
        // 清理临时文件
        try {
            await unlink(tmpFile);
        } catch (e) {
            // 忽略清理错误
        }
    }
}

// 运行Python脚本
function runPython(scriptPath) {
    return new Promise((resolve, reject) => {
        const pythonPath = '/home/chenzongwei/.conda/envs/chenzongwei311/bin/python';
        const proc = spawn(pythonPath, [scriptPath], {
            timeout: 65000,  // 65秒超时（比代码内超时稍长）
            killSignal: 'SIGTERM'
        });

        let stdout = '';
        let stderr = '';

        proc.stdout.on('data', (data) => {
            stdout += data.toString();
        });

        proc.stderr.on('data', (data) => {
            stderr += data.toString();
        });

        proc.on('close', (code) => {
            resolve({
                stdout,
                stderr,
                exitCode: code
            });
        });

        proc.on('error', (err) => {
            reject(err);
        });
    });
}
