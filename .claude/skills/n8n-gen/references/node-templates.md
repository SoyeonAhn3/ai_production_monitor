# n8n 노드 JSON 템플릿

n8n 워크플로 JSON 생성 시 참조하는 노드별 기본 구조.

---

## 공통 노드 속성

모든 노드에 포함되는 기본 속성:

```json
{
  "id": "고유UUID",
  "name": "노드 표시명",
  "type": "노드타입",
  "typeVersion": 버전숫자,
  "position": [x, y],
  "parameters": {}
}
```

---

## Webhook 노드

```json
{
  "type": "n8n-nodes-base.webhook",
  "typeVersion": 2,
  "parameters": {
    "path": "simulate",
    "httpMethod": "GET",
    "responseMode": "responseNode"
  }
}
```

---

## Schedule Trigger 노드

```json
{
  "type": "n8n-nodes-base.scheduleTrigger",
  "typeVersion": 1.2,
  "parameters": {
    "rule": {
      "interval": [
        {
          "field": "cronExpression",
          "expression": "10 8-17 * * 1-5"
        }
      ]
    }
  }
}
```

- 매시간 10분: `"10 * * * *"`
- 매시간 10분 (08~17시, 월~금): `"10 8-17 * * 1-5"`
- 매주 월요일 07:50: `"50 7 * * 1"`
- 매일 08:00: `"0 8 * * *"`

---

## Microsoft Excel 365 노드 (OneDrive)

### 읽기 (Get Rows)

```json
{
  "type": "n8n-nodes-base.microsoftExcel",
  "typeVersion": 2,
  "parameters": {
    "operation": "getRows",
    "workbook": {
      "__rl": true,
      "value": "파일경로 또는 ID",
      "mode": "list"
    },
    "worksheet": {
      "__rl": true,
      "value": "시트명",
      "mode": "list"
    },
    "dataLocationOnSheet": {
      "rangeDefinition": "detectAutomatically"
    }
  },
  "credentials": {
    "microsoftExcelOAuth2Api": {
      "id": "PLACEHOLDER",
      "name": "Microsoft Excel account"
    }
  }
}
```

### 쓰기 (Append Row)

```json
{
  "type": "n8n-nodes-base.microsoftExcel",
  "typeVersion": 2,
  "parameters": {
    "operation": "append",
    "workbook": {
      "__rl": true,
      "value": "파일경로 또는 ID",
      "mode": "list"
    },
    "worksheet": {
      "__rl": true,
      "value": "시트명",
      "mode": "list"
    },
    "dataMode": "autoMapInputData"
  },
  "credentials": {
    "microsoftExcelOAuth2Api": {
      "id": "PLACEHOLDER",
      "name": "Microsoft Excel account"
    }
  }
}
```

---

## Code 노드 (JavaScript)

```json
{
  "type": "n8n-nodes-base.code",
  "typeVersion": 2,
  "parameters": {
    "jsCode": "// JavaScript 코드\nreturn items;"
  }
}
```

### Static Data 사용 (카운터 등)

```javascript
// 읽기
const staticData = $getWorkflowStaticData('global');
const counter = staticData.counter || 0;

// 쓰기
staticData.counter = counter + 1;
```

---

## IF 노드

```json
{
  "type": "n8n-nodes-base.if",
  "typeVersion": 2,
  "parameters": {
    "conditions": {
      "options": {
        "caseSensitive": true,
        "leftValue": "",
        "typeValidation": "strict"
      },
      "conditions": [
        {
          "id": "고유ID",
          "leftValue": "={{ $json.hasSevere }}",
          "rightValue": true,
          "operator": {
            "type": "boolean",
            "operation": "equals"
          }
        }
      ],
      "combinator": "and"
    }
  }
}
```

---

## Gmail 노드

```json
{
  "type": "n8n-nodes-base.gmail",
  "typeVersion": 2.1,
  "parameters": {
    "sendTo": "recipient@example.com",
    "subject": "={{ $json.emailSubject }}",
    "emailType": "html",
    "message": "={{ $json.emailBody }}"
  },
  "credentials": {
    "gmailOAuth2": {
      "id": "PLACEHOLDER",
      "name": "Gmail account"
    }
  }
}
```

---

## HTTP Request 노드 (Claude API)

```json
{
  "type": "n8n-nodes-base.httpRequest",
  "typeVersion": 4.2,
  "parameters": {
    "method": "POST",
    "url": "https://api.anthropic.com/v1/messages",
    "authentication": "genericCredentialType",
    "genericAuthType": "httpHeaderAuth",
    "sendHeaders": true,
    "headerParameters": {
      "parameters": [
        { "name": "x-api-key", "value": "={{ $credentials.apiKey }}" },
        { "name": "anthropic-version", "value": "2023-06-01" },
        { "name": "content-type", "value": "application/json" }
      ]
    },
    "sendBody": true,
    "specifyBody": "json",
    "jsonBody": "={{ JSON.stringify($json.requestBody) }}"
  },
  "credentials": {
    "httpHeaderAuth": {
      "id": "PLACEHOLDER",
      "name": "Anthropic API"
    }
  }
}
```

---

## Respond to Webhook 노드

```json
{
  "type": "n8n-nodes-base.respondToWebhook",
  "typeVersion": 1.1,
  "parameters": {
    "respondWith": "json",
    "responseBody": "={{ JSON.stringify($json.response) }}"
  }
}
```

---

## NoOp 노드 (아무것도 안 함 — placeholder)

```json
{
  "type": "n8n-nodes-base.noOp",
  "typeVersion": 1,
  "parameters": {}
}
```

---

## connections 구조

노드 간 연결을 정의하는 객체. 키는 출력 노드명, 값은 연결 대상.

```json
{
  "connections": {
    "Webhook": {
      "main": [
        [
          {
            "node": "Read Counter",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Read Counter": {
      "main": [
        [
          {
            "node": "Next Node",
            "type": "main",
            "index": 0
          }
        ]
      ]
    }
  }
}
```

### IF 노드 연결 (분기)

IF 노드는 output이 2개: index 0 = true, index 1 = false

```json
{
  "IF": {
    "main": [
      [{ "node": "True Branch Node", "type": "main", "index": 0 }],
      [{ "node": "False Branch Node", "type": "main", "index": 0 }]
    ]
  }
}
```
