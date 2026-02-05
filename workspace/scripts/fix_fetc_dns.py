#!/usr/bin/env python3
"""Fix fetc docker-compose.yml DNS configuration"""

import yaml
import sys

def fix_dns():
    path = '/Users/sulaxd/Documents/fetc/docker-compose.yml'
    
    with open(path, 'r') as f:
        data = yaml.safe_load(f)
    
    # Add DNS configuration
    data['services']['fetc-batch']['dns'] = ['8.8.8.8', '8.8.4.4']
    
    with open(path, 'w') as f:
        yaml.dump(data, f, default_flow_style=False, allow_unicode=True, sort_keys=False)
    
    print("DNS configuration added successfully")
    print("Added: dns: ['8.8.8.8', '8.8.4.4']")

if __name__ == '__main__':
    fix_dns()
