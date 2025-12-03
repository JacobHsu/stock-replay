#!/usr/bin/env python3
"""
移除黑名單股票
從 taiwan_stocks.json 中移除指定的股票代碼
"""

import json
from pathlib import Path

# 黑名單股票代碼
BLACKLIST = [
    "1213",  # 大飲
    "1309",  # 台達化
    "1305",  # 華夏
    "1310",  # 台苯
    "1312",  # 國喬
    "1313",  # 聯成
    "1314",  # 中石化
    "1316",  # 上曜
    "1413",  # 宏洲
    "1417",  # 嘉裕
    "1418",  # 東華
    "1435",  # 中福
    "1439",  # 雋揚
    "1444",  # 力麗
    "1447",  # 力鵬
    "1454",  # 台富
    "1455",  # 集盛
    "1456",  # 怡華
    "1467",  # 南緯
    "1471",  # 首利
    "1512",  # 瑞利
    "1515",  # 力山
    "1516",  # 川飛
    "1517",  # 利奇
    "1528",  # 恩德
    "1536",  # 和大
    "1569",  # 濱川
    "1584",  # 精剛
    "1598",  # 岱宇
    "1617",  # 榮星
    "1718",  # 中纖
    "1721",  # 三晃
    "1732",  # 毛寶
    "1742",  # 台蠟
]

def remove_blacklist_stocks():
    """從 taiwan_stocks.json 移除黑名單股票"""
    
    # 讀取檔案
    json_path = Path(__file__).parent / "data" / "taiwan_stocks.json"
    
    print(f"讀取檔案: {json_path}")
    with open(json_path, "r", encoding="utf-8") as f:
        stocks = json.load(f)
    
    original_count = len(stocks)
    print(f"原始股票數量: {original_count}")
    
    # 移除黑名單股票
    removed = []
    for code in BLACKLIST:
        if code in stocks:
            stock_info = stocks[code]
            removed.append(f"{code} - {stock_info['name']}")
            del stocks[code]
            print(f"✓ 移除: {code} - {stock_info['name']}")
        else:
            print(f"✗ 未找到: {code}")
    
    # 寫回檔案
    with open(json_path, "w", encoding="utf-8") as f:
        json.dump(stocks, f, ensure_ascii=False, indent=2)
    
    final_count = len(stocks)
    removed_count = original_count - final_count
    
    print(f"\n完成!")
    print(f"移除數量: {removed_count}")
    print(f"剩餘股票: {final_count}")
    print(f"\n已移除的股票:")
    for item in removed:
        print(f"  - {item}")

if __name__ == "__main__":
    remove_blacklist_stocks()
