#!/usr/bin/env python3
"""
老領班風控偵測系統 - 整合測試
測試與現有系統的整合點
"""

import os
import sys
import json
import subprocess
from pathlib import Path

def test_environment():
    """測試環境配置"""
    print("🧪 測試環境配置...")
    
    # 檢查 Python 版本
    python_version = sys.version_info
    print(f"  Python 版本: {python_version.major}.{python_version.minor}.{python_version.micro}")
    assert python_version.major == 3 and python_version.minor >= 8, "需要 Python 3.8+"
    
    # 檢查當前目錄
    current_dir = os.getcwd()
    print(f"  當前目錄: {current_dir}")
    
    # 檢查必要目錄
    required_dirs = ['config', 'sql', 'logs', 'reports', 'data']
    for dir_name in required_dirs:
        dir_path = os.path.join(current_dir, dir_name)
        if os.path.exists(dir_path):
            print(f"  ✅ {dir_name}/ 目錄存在")
        else:
            print(f"  ❌ {dir_name}/ 目錄不存在")
            return False
    
    return True

def test_dependencies():
    """測試 Python 依賴"""
    print("\n🧪 測試 Python 依賴...")
    
    dependencies = [
        ('pymysql', '1.1.0'),
        ('requests', '2.31.0'),
        ('yaml', '6.0.0'),  # PyYAML
    ]
    
    all_ok = True
    for dep, min_version in dependencies:
        try:
            if dep == 'yaml':
                import yaml
                version = yaml.__version__
                module_name = 'PyYAML'
            else:
                module = __import__(dep)
                version = getattr(module, '__version__', '未知')
                module_name = dep
            
            print(f"  ✅ {module_name}: {version}")
            
        except ImportError:
            print(f"  ❌ {dep}: 未安裝")
            all_ok = False
    
    return all_ok

def test_config_files():
    """測試配置文件"""
    print("\n🧪 測試配置文件...")
    
    config_files = [
        ('.env', False),  # .env 應該存在但可能未配置
        ('.env.example', True),  # 示例文件必須存在
        ('config/database.yaml', True),
        ('sql/risk_detection.sql', True),
    ]
    
    all_ok = True
    for file_path, required in config_files:
        full_path = os.path.join(os.getcwd(), file_path)
        
        if os.path.exists(full_path):
            size = os.path.getsize(full_path)
            print(f"  ✅ {file_path} ({size} bytes)")
            
            # 檢查 .env 是否已配置
            if file_path == '.env':
                with open(full_path, 'r', encoding='utf-8') as f:
                    content = f.read()
                    if 'your_password_here' in content or 'your_token_here' in content:
                        print(f"  ⚠️  {file_path} 包含默認值，請配置實際值")
        else:
            if required:
                print(f"  ❌ {file_path}: 文件不存在")
                all_ok = False
            else:
                print(f"  ⚠️  {file_path}: 文件不存在（非必需）")
    
    return all_ok

def test_main_script():
    """測試主腳本"""
    print("\n🧪 測試主腳本...")
    
    script_path = os.path.join(os.getcwd(), 'boss_eye.py')
    
    # 檢查文件是否存在且可執行
    if not os.path.exists(script_path):
        print(f"  ❌ boss_eye.py: 文件不存在")
        return False
    
    # 檢查文件權限
    import stat
    st = os.stat(script_path)
    executable = bool(st.st_mode & stat.S_IXUSR)
    print(f"  ✅ boss_eye.py 存在 ({os.path.getsize(script_path)} bytes)")
    print(f"  ✅ 可執行權限: {'是' if executable else '否'}")
    
    # 測試 --help 參數
    try:
        result = subprocess.run(
            [sys.executable, script_path, '--help'],
            capture_output=True,
            text=True,
            timeout=10
        )
        
        if result.returncode == 0:
            print("  ✅ --help 參數正常")
            # 顯示幫助信息的前幾行
            help_lines = result.stdout.strip().split('\n')[:5]
            for line in help_lines:
                print(f"    {line}")
        else:
            print(f"  ❌ --help 參數失敗: {result.stderr}")
            return False
            
    except subprocess.TimeoutExpired:
        print("  ❌ --help 參數超時")
        return False
    except Exception as e:
        print(f"  ❌ 測試失敗: {e}")
        return False
    
    return True

def test_test_mode():
    """測試測試模式"""
    print("\n🧪 測試測試模式...")
    
    script_path = os.path.join(os.getcwd(), 'boss_eye.py')
    
    try:
        result = subprocess.run(
            [sys.executable, script_path, '--test'],
            capture_output=True,
            text=True,
            timeout=30
        )
        
        print(f"  退出碼: {result.returncode}")
        
        if result.returncode == 0:
            print("  ✅ 測試模式運行成功")
            
            # 檢查輸出內容
            output = result.stdout
            if '老領班風控報告' in output:
                print("  ✅ 報告生成正常")
                
                # 提取報告摘要
                lines = output.strip().split('\n')
                for i, line in enumerate(lines[:10]):
                    print(f"    {line}")
                
                if len(lines) > 10:
                    print(f"    ... 還有 {len(lines)-10} 行")
            else:
                print("  ⚠️  報告標題未找到")
                
        else:
            print(f"  ❌ 測試模式失敗")
            print(f"  錯誤輸出:\n{result.stderr}")
            return False
            
    except subprocess.TimeoutExpired:
        print("  ❌ 測試模式超時")
        return False
    except Exception as e:
        print(f"  ❌ 測試失敗: {e}")
        return False
    
    return True

def test_report_generation():
    """測試報告生成"""
    print("\n🧪 測試報告生成...")
    
    reports_dir = os.path.join(os.getcwd(), 'reports')
    
    # 查找最新的測試報告
    txt_files = list(Path(reports_dir).glob('test_report_*.txt'))
    json_files = list(Path(reports_dir).glob('test_report_*.json'))
    
    if txt_files:
        latest_txt = max(txt_files, key=os.path.getctime)
        txt_size = os.path.getsize(latest_txt)
        print(f"  ✅ 文本報告: {latest_txt.name} ({txt_size} bytes)")
        
        # 讀取報告內容
        with open(latest_txt, 'r', encoding='utf-8') as f:
            content = f.read()
            lines = content.strip().split('\n')
            print(f"    行數: {len(lines)}")
            print(f"    示例: {lines[0][:50]}..." if lines else "    空文件")
    else:
        print("  ⚠️  未找到文本報告")
    
    if json_files:
        latest_json = max(json_files, key=os.path.getctime)
        json_size = os.path.getsize(latest_json)
        print(f"  ✅ JSON 報告: {latest_json.name} ({json_size} bytes)")
        
        # 驗證 JSON 格式
        try:
            with open(latest_json, 'r', encoding='utf-8') as f:
                data = json.load(f)
                print(f"    JSON 鍵: {list(data.keys())}")
        except json.JSONDecodeError as e:
            print(f"  ❌ JSON 解析錯誤: {e}")
            return False
    else:
        print("  ⚠️  未找到 JSON 報告")
    
    return True

def test_logging():
    """測試日誌系統"""
    print("\n🧪 測試日誌系統...")
    
    logs_dir = os.path.join(os.getcwd(), 'logs')
    
    # 查找最新的日誌文件
    log_files = list(Path(logs_dir).glob('*.log'))
    
    if log_files:
        latest_log = max(log_files, key=os.path.getctime)
        log_size = os.path.getsize(latest_log)
        print(f"  ✅ 日誌文件: {latest_log.name} ({log_size} bytes)")
        
        # 讀取最後幾行日誌
        try:
            with open(latest_log, 'r', encoding='utf-8') as f:
                lines = f.readlines()[-5:]  # 最後5行
                print(f"    最後 {len(lines)} 行:")
                for line in lines:
                    print(f"    {line.strip()}")
        except Exception as e:
            print(f"  ⚠️  讀取日誌失敗: {e}")
    else:
        print("  ⚠️  未找到日誌文件")
    
    return True

def test_integration_with_existing_skills():
    """測試與現有技能的整合"""
    print("\n🧪 測試與現有技能整合...")
    
    # 檢查 bg666-db 技能
    bg666_skill_path = os.path.join(os.path.dirname(os.getcwd()), 'bg666-db')
    
    if os.path.exists(bg666_skill_path):
        print(f"  ✅ bg666-db 技能存在: {bg666_skill_path}")
        
        # 檢查關鍵文件
        bg666_files = ['scripts/query.py', 'scripts/matomo.py', 'scripts/tg.py']
        for file in bg666_files:
            full_path = os.path.join(bg666_skill_path, file)
            if os.path.exists(full_path):
                print(f"    ✅ {file}")
            else:
                print(f"    ⚠️  {file} 不存在")
    else:
        print(f"  ⚠️  bg666-db 技能不存在，部分功能可能受限")
    
    return True

def run_all_tests():
    """運行所有測試"""
    print("=" * 60)
    print("🕵️ 老領班風控偵測系統 - 整合測試套件")
    print("=" * 60)
    
    tests = [
        ("環境配置", test_environment),
        ("Python 依賴", test_dependencies),
        ("配置文件", test_config_files),
        ("主腳本", test_main_script),
        ("測試模式", test_test_mode),
        ("報告生成", test_report_generation),
        ("日誌系統", test_logging),
        ("現有技能整合", test_integration_with_existing_skills),
    ]
    
    results = []
    
    for test_name, test_func in tests:
        try:
            success = test_func()
            results.append((test_name, success))
        except Exception as e:
            print(f"\n💥 測試 '{test_name}' 異常: {e}")
            import traceback
            traceback.print_exc()
            results.append((test_name, False))
    
    # 輸出測試摘要
    print("\n" + "=" * 60)
    print("📊 測試結果摘要")
    print("=" * 60)
    
    passed = 0
    total = len(results)
    
    for test_name, success in results:
        status = "✅ 通過" if success else "❌ 失敗"
        print(f"{test_name:20} {status}")
        if success:
            passed += 1
    
    print("-" * 60)
    print(f"總測試數: {total}")
    print(f"通過數: {passed}")
    print(f"失敗數: {total - passed}")
    print(f"通過率: {passed/total*100:.1f}%")
    
    if passed == total:
        print("\n🎉 所有測試通過！系統準備就緒。")
        return True
    else:
        print(f"\n⚠️  {total - passed} 個測試失敗，請檢查問題。")
        return False

def main():
    """主函數"""
    try:
        success = run_all_tests()
        sys.exit(0 if success else 1)
    except KeyboardInterrupt:
        print("\n⏹️ 測試被用戶中斷")
        sys.exit(130)
    except Exception as e:
        print(f"\n💥 測試套件異常: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)

if __name__ == "__main__":
    main()