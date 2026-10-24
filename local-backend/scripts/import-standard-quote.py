import argparse
import json
import re
import shutil
import sqlite3
from datetime import datetime
from pathlib import Path

import openpyxl


SERVICE_SHEETS = ("家电维修", "清洗保养安装", "水电管道厨卫")
COLORS = ("#1888ff", "#5865f2", "#12a594", "#e8952f", "#8a63df", "#df5c55")


def parse_price(value):
    text = str(value or "").strip()
    nums = [int(x) for x in re.findall(r"\d+", text)]
    if not nums:
        return 0, 0, text
    low, high = nums[0], nums[1] if len(nums) > 1 else nums[0]
    return low, high, text


def parse_warranty(value):
    match = re.search(r"\d+", str(value or ""))
    return int(match.group()) if match else 0


def parse_extra_amount(value):
    text = str(value or "").strip()
    price_range = re.search(r"(\d+)\s*-\s*(\d+)\s*元", text)
    if price_range:
        return round((int(price_range.group(1)) + int(price_range.group(2))) / 2)
    single_price = re.search(r"(?:最低加收|加收|^)(\d+)\s*元", text)
    if single_price:
        return int(single_price.group(1))
    starting_price = re.search(r"(\d+)\s*元起", text)
    return int(starting_price.group(1)) if starting_price else 0


def rows_from_workbook(path):
    book = openpyxl.load_workbook(path, read_only=True, data_only=True)
    categories = []
    services = []
    category_ids = {}

    def category_id(name):
        if name not in category_ids:
            category_ids[name] = f"cat_{len(category_ids) + 1:03d}"
            categories.append((category_ids[name], name, len(categories)))
        return category_ids[name]

    for sheet_name in SERVICE_SHEETS:
        sheet = book[sheet_name]
        for row_number, row in enumerate(sheet.iter_rows(min_row=5, values_only=True), 5):
            category, name, desc, price, includes, excludes, warranty = row[:7]
            if not category or not name:
                continue
            low, high, price_text = parse_price(price)
            services.append({
                "id": f"svc_{len(services) + 1:03d}",
                "category_id": category_id(str(category).strip()),
                "name": str(name).strip(),
                "description": str(desc or "").strip(),
                "low": low,
                "high": high,
                "part": 0,
                "warranty_days": parse_warranty(warranty),
                "includes": str(includes or "").strip(),
                "excludes": str(excludes or "").strip(),
                "price_text": price_text,
                "meta": json.dumps({"sourceSheet": sheet_name, "sourceRow": row_number}, ensure_ascii=False),
            })

    package_sheet = book["合作套餐"]
    package_category = category_id("合作套餐")
    for row_number, row in enumerate(package_sheet.iter_rows(min_row=5, values_only=True), 5):
        name, partner, content, price, suggestion = row[:5]
        if not name:
            continue
        low, high, price_text = parse_price(price)
        services.append({
            "id": f"svc_{len(services) + 1:03d}",
            "category_id": package_category,
            "name": str(name).strip(),
            "description": str(content or "").strip(),
            "low": low,
            "high": high,
            "part": 0,
            "warranty_days": 0,
            "includes": f"适用合作商：{partner}" if partner else "",
            "excludes": str(suggestion or "").strip(),
            "price_text": price_text,
            "meta": json.dumps({"sourceSheet": "合作套餐", "sourceRow": row_number}, ensure_ascii=False),
        })

    extras = []
    sheet = book["特殊费用及规则"]
    for row_number, row in enumerate(sheet.iter_rows(min_row=5, values_only=True), 5):
        name, price, scene = row[:3]
        if not name:
            continue
        price_text = str(price or "").strip()
        amount = parse_extra_amount(price_text)
        extras.append((f"extra_{len(extras) + 1:03d}", str(name).strip(), amount, price_text, str(scene or "").strip()))
    return categories, services, extras


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("workbook", type=Path)
    parser.add_argument("database", type=Path)
    args = parser.parse_args()
    categories, services, extras = rows_from_workbook(args.workbook)

    timestamp = datetime.now().strftime("%Y%m%d-%H%M%S")
    backup = args.database.with_name(f"{args.database.stem}.before-excel-{timestamp}{args.database.suffix}")
    shutil.copy2(args.database, backup)

    db = sqlite3.connect(args.database)
    try:
        db.execute("PRAGMA foreign_keys=ON")
        columns = {row[1] for row in db.execute("PRAGMA table_info(services)")}
        if "price_text" not in columns:
            db.execute("ALTER TABLE services ADD COLUMN price_text TEXT")
            db.commit()
        db.execute("BEGIN IMMEDIATE")
        db.execute("DELETE FROM services")
        db.execute("DELETE FROM extras")
        db.execute("DELETE FROM brands")
        db.execute("DELETE FROM categories")
        for category_id, name, sort_order in categories:
            tone = COLORS[sort_order % len(COLORS)]
            db.execute(
                "INSERT INTO categories (id,name,enabled,sort_order,tone,accent,image,meta) VALUES (?,?,?,?,?,?,?,?)",
                (category_id, name, 1, sort_order, tone, "#f5a623", "", json.dumps({"source": "壹思源维修—标准报价表.xlsx"}, ensure_ascii=False)),
            )
        all_category_ids = [item[0] for item in categories]
        db.execute(
            "INSERT INTO brands (id,name,latin,color,factor,category_ids,categories,special,logo,meta) VALUES (?,?,?,?,?,?,?,?,?,?)",
            ("brand_general", "通用品牌", "GENERAL", "#14766f", 1, json.dumps(all_category_ids), json.dumps([item[1] for item in categories], ensure_ascii=False), 0, "", "{}"),
        )
        for service in services:
            db.execute(
                "INSERT INTO services (id,category_id,name,description,low,high,part,warranty_days,includes,excludes,price_text,enabled,meta) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)",
                (service["id"], service["category_id"], service["name"], service["description"], service["low"], service["high"], service["part"], service["warranty_days"], service["includes"], service["excludes"], service["price_text"], 1, service["meta"]),
            )
        db.executemany("INSERT INTO extras (id,name,amount,enabled,price,scene) VALUES (?,?,?,1,?,?)", extras)
        db.execute("INSERT OR REPLACE INTO app_meta (key,value) VALUES ('quote_import_source',?)", (str(args.workbook),))
        db.execute("INSERT OR REPLACE INTO app_meta (key,value) VALUES ('quote_imported_at',?)", (datetime.now().isoformat(timespec="seconds"),))
        db.commit()
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()
    print(json.dumps({"backup": str(backup), "categories": len(categories), "services": len(services), "extras": len(extras), "brands": 1}, ensure_ascii=False))


if __name__ == "__main__":
    main()
