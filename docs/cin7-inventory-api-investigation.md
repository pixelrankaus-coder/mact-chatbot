# Cin7 Inventory API Investigation

**Date:** 2026-03-10

---

## Products

**URL:** `/product?Page=1&Limit=5`

**Status:** 200
**Total Records:** 841
**Notes:** List key: Products | Record count on page: 5

### Fields

| Field | Type | Sample Value |
|-------|------|-------------|
| ID | string | d25af813-cfb8-4aaa-994f-17adab269b1a |
| SKU | string | $100discount coupon discount |
| Name | string | $100discount coupon discount |
| Category | string | Raw Material |
| Brand | null | null |
| Type | string | Service |
| CostingMethod | string | FIFO |
| DropShipMode | string | No Drop Ship |
| DefaultLocation | string | Banyo Head Office |
| Length | number | 0 |
| Width | number | 0 |
| Height | number | 0 |
| Weight | number | 0 |
| UOM | string | Each |
| WeightUnits | string |  |
| DimensionsUnits | string |  |
| Barcode | null | null |
| MinimumBeforeReorder | number | 0 |
| ReorderQuantity | number | 0 |
| PriceTier1 | number | -100 |
| PriceTier2 | number | 0 |
| PriceTier3 | number | 0 |
| PriceTier4 | number | 0 |
| PriceTier5 | number | 0 |
| PriceTier6 | number | 0 |
| PriceTier7 | number | 0 |
| PriceTier8 | number | 0 |
| PriceTier9 | number | 0 |
| PriceTier10 | number | 0 |
| PriceTiers | object | {"RRP":-100,"Sale Price on Website":0,"Distributer":0,"Training":0,"Distributer Bulk":0,"Trade C":0, |
| AverageCost | number | 0 |
| ShortDescription | null | null |
| InternalNote | null | null |
| Description | null | null |
| AdditionalAttribute1 | null | null |
| AdditionalAttribute2 | null | null |
| AdditionalAttribute3 | null | null |
| AdditionalAttribute4 | null | null |
| AdditionalAttribute5 | null | null |
| AdditionalAttribute6 | null | null |
| AdditionalAttribute7 | null | null |
| AdditionalAttribute8 | null | null |
| AdditionalAttribute9 | null | null |
| AdditionalAttribute10 | null | null |
| AttributeSet | string | Raw Material |
| DiscountRule | null | null |
| Tags | null | null |
| Status | string | Active |
| StockLocator | null | null |
| COGSAccount | null | null |
| RevenueAccount | null | null |
| ExpenseAccount | null | null |
| InventoryAccount | null | null |
| PurchaseTaxRule | null | null |
| SaleTaxRule | null | null |
| LastModifiedOn | string | 2024-08-18T11:43:38.777Z |
| Sellable | boolean | true |
| PickZones | null | null |
| BillOfMaterial | boolean | false |
| AutoAssembly | boolean | false |
| AutoDisassembly | boolean | false |
| QuantityToProduce | number | 1 |
| AlwaysShowQuantity | null | null |
| AssemblyInstructionURL | null | null |
| AssemblyCostEstimationMethod | string | Average Cost |
| Suppliers | array[0] | [] |
| ReorderLevels | array[0] | [] |
| BillOfMaterialsProducts | array[0] | [] |
| BillOfMaterialsServices | array[0] | [] |
| Movements | array[0] | [] |
| Attachments | array[0] | [] |
| BOMType | string | None |
| WarrantyName | null | null |
| CustomPrices | array[0] | [] |
| CartonHeight | null | null |
| CartonWidth | null | null |
| CartonLength | null | null |
| CartonQuantity | null | null |
| CartonInnerQuantity | null | null |
| HSCode | null | null |
| CountryOfOrigin | null | null |
| CountryOfOriginCode | null | null |
| CreatedDate | string | 2024-08-18T11:43:38.787 |

<details><summary>Full sample record JSON</summary>

```json
{
  "ID": "d25af813-cfb8-4aaa-994f-17adab269b1a",
  "SKU": "$100discount coupon discount",
  "Name": "$100discount coupon discount",
  "Category": "Raw Material",
  "Brand": null,
  "Type": "Service",
  "CostingMethod": "FIFO",
  "DropShipMode": "No Drop Ship",
  "DefaultLocation": "Banyo Head Office",
  "Length": 0,
  "Width": 0,
  "Height": 0,
  "Weight": 0,
  "UOM": "Each",
  "WeightUnits": "",
  "DimensionsUnits": "",
  "Barcode": null,
  "MinimumBeforeReorder": 0,
  "ReorderQuantity": 0,
  "PriceTier1": -100,
  "PriceTier2": 0,
  "PriceTier3": 0,
  "PriceTier4": 0,
  "PriceTier5": 0,
  "PriceTier6": 0,
  "PriceTier7": 0,
  "PriceTier8": 0,
  "PriceTier9": 0,
  "PriceTier10": 0,
  "PriceTiers": {
    "RRP": -100,
    "Sale Price on Website": 0,
    "Distributer": 0,
    "Training": 0,
    "Distributer Bulk": 0,
    "Trade C": 0,
    "Trade D": 0,
    "Trade E": 0,
    "Trade F": 0,
    "Trade G": 0
  },
  "AverageCost": 0,
  "ShortDescription": null,
  "InternalNote": null,
  "Description": null,
  "AdditionalAttribute1": null,
  "AdditionalAttribute2": null,
  "AdditionalAttribute3": null,
  "AdditionalAttribute4": null,
  "AdditionalAttribute5": null,
  "AdditionalAttribute6": null,
  "AdditionalAttribute7": null,
  "AdditionalAttribute8": null,
  "AdditionalAttribute9": null,
  "AdditionalAttribute10": null,
  "AttributeSet": "Raw Material",
  "DiscountRule": null,
  "Tags": null,
  "Status": "Active",
  "StockLocator": null,
  "COGSAccount": null,
  "RevenueAccount": null,
  "ExpenseAccount": null,
  "InventoryAccount": null,
  "PurchaseTaxRule": null,
  "SaleTaxRule": null,
  "LastModifiedOn": "2024-08-18T11:43:38.777Z",
  "Sellable": true,
  "PickZones": null,
  "BillOfMaterial": false,
  "AutoAssembly": false,
  "AutoDisassembly": false,
  "QuantityToProduce": 1,
  "AlwaysShowQuantity": null,
  "AssemblyInstructionURL": null,
  "AssemblyCostEstimationMethod": "Average Cost",
  "Suppliers": [],
  "ReorderLevels": [],
  "BillOfMaterialsProducts": [],
  "BillOfMaterialsServices": [],
  "Movements": [],
  "Attachments": [],
  "BOMType": "None",
  "WarrantyName": null,
  "CustomPrices": [],
  "CartonHeight": null,
  "CartonWidth": null,
  "CartonLength": null,
  "CartonQuantity": null,
  "CartonInnerQuantity": null,
  "HSCode": null,
  "CountryOfOrigin": null,
  "CountryOfOriginCode": null,
  "CreatedDate": "2024-08-18T11:43:38.787"
}
```
</details>

---

## ProductAvailability

**URL:** `/ref/productavailability?Page=1&Limit=5`

**Status:** 200
**Total Records:** 282
**Notes:** List key: ProductAvailabilityList | Record count on page: 5

### Fields

| Field | Type | Sample Value |
|-------|------|-------------|
| ID | string | ce95468e-2a8a-40e6-9bd4-0011f0c674f3 |
| SKU | string | HN5QU8-20 |
| Name | string | MACt Glass Fibre Rebar 8mm 20m |
| Barcode | string |  |
| Location | string | Banyo Head Office |
| Bin | null | null |
| Batch | null | null |
| ExpiryDate | null | null |
| OnHand | number | 2 |
| Allocated | number | 0 |
| Available | number | 2 |
| OnOrder | number | 0 |
| StockOnHand | number | 66.338 |
| InTransit | number | 0 |
| NextDeliveryDate | null | null |

<details><summary>Full sample record JSON</summary>

```json
{
  "ID": "ce95468e-2a8a-40e6-9bd4-0011f0c674f3",
  "SKU": "HN5QU8-20",
  "Name": "MACt Glass Fibre Rebar 8mm 20m",
  "Barcode": "",
  "Location": "Banyo Head Office",
  "Bin": null,
  "Batch": null,
  "ExpiryDate": null,
  "OnHand": 2,
  "Allocated": 0,
  "Available": 2,
  "OnOrder": 0,
  "StockOnHand": 66.338,
  "InTransit": 0,
  "NextDeliveryDate": null
}
```
</details>

---

## ProductCategories

**URL:** `/ref/productCategory`

**Status:** 0
**Errors:** SyntaxError: Unexpected token '<', "<!DOCTYPE "... is not valid JSON
**Notes:** Fetch failed

---

## ProductBrand

**URL:** `/ref/productBrand`

**Status:** 0
**Errors:** SyntaxError: Unexpected token '<', "<!DOCTYPE "... is not valid JSON
**Notes:** Fetch failed

---

## ProductFamily

**URL:** `/ref/productFamily`

**Status:** 0
**Errors:** SyntaxError: Unexpected token '<', "<!DOCTYPE "... is not valid JSON
**Notes:** Fetch failed

---

## Locations

**URL:** `/ref/location`

**Status:** 200
**Total Records:** 3
**Notes:** List key: LocationList | Record count on page: 3

### Fields

| Field | Type | Sample Value |
|-------|------|-------------|
| ID | string | 54a9a8c5-e471-4ee0-bdf8-3992e4de28ac |
| Name | string | Banyo Head Office |
| IsDefault | boolean | true |
| IsDeprecated | boolean | false |
| ParentID | null | null |
| Bins | array[0] | [] |
| FixedAssetsLocation | boolean | false |
| AddressLine1 | string | Unit 3C/ 919-925 Nudgee Road |
| AddressLine2 | string |  |
| AddressCitySuburb | string | Banyo |
| AddressStateProvince | string | QLD |
| AddressZipPostCode | string | 4014 |
| AddressCountry | string | Australia |
| PickZones | string |  |
| IsCoMan | boolean | false |
| IsShopFloor | boolean | false |
| IsStaging | boolean | false |

<details><summary>Full sample record JSON</summary>

```json
{
  "ID": "54a9a8c5-e471-4ee0-bdf8-3992e4de28ac",
  "Name": "Banyo Head Office",
  "IsDefault": true,
  "IsDeprecated": false,
  "ParentID": null,
  "Bins": [],
  "FixedAssetsLocation": false,
  "AddressLine1": "Unit 3C/ 919-925 Nudgee Road",
  "AddressLine2": "",
  "AddressCitySuburb": "Banyo",
  "AddressStateProvince": "QLD",
  "AddressZipPostCode": "4014",
  "AddressCountry": "Australia",
  "PickZones": "",
  "IsCoMan": false,
  "IsShopFloor": false,
  "IsStaging": false
}
```
</details>

---

## PurchaseList

**URL:** `/purchaseList?Page=1&Limit=5`

**Status:** 200
**Total Records:** 1727
**Notes:** List key: PurchaseList | Record count on page: 5

### Fields

| Field | Type | Sample Value |
|-------|------|-------------|
| ID | string | ea47e26b-62fa-498c-972f-731716693c68 |
| BlindReceipt | boolean | false |
| OrderNumber | string | PO-00001 |
| Status | string | RECEIVED |
| OrderDate | string | 2021-02-03T00:00:00 |
| InvoiceDate | null | null |
| Supplier | string | RF Composites Pty Ltd |
| SupplierID | string | e5f1f4a0-c501-45a0-960a-9a851bdc0e7a |
| InvoiceNumber | string |  |
| InvoiceAmount | number | 19 |
| PaidAmount | number | 0 |
| InvoiceDueDate | null | null |
| RequiredBy | string | 2021-02-28T00:00:00 |
| BaseCurrency | string | AUD |
| SupplierCurrency | string | AUD |
| CreditNoteNumber | string |  |
| OrderStatus | string | RECEIVED |
| StockReceivedStatus | string | AUTHORISED |
| UnstockStatus | string | NOT AVAILABLE |
| InvoiceStatus | string | DRAFT |
| CreditNoteStatus | string | NOT AVAILABLE |
| LastUpdatedDate | string | 2022-02-10T06:43:38.833 |
| Type | string | Advanced Purchase |
| CombinedInvoiceStatus | string | NOT INVOICED |
| CombinedPaymentStatus | string | UNPAID |
| CombinedReceivingStatus | string | FULLY RECEIVED |
| IsServiceOnly | boolean | false |
| DropShipTaskID | null | null |

<details><summary>Full sample record JSON</summary>

```json
{
  "ID": "ea47e26b-62fa-498c-972f-731716693c68",
  "BlindReceipt": false,
  "OrderNumber": "PO-00001",
  "Status": "RECEIVED",
  "OrderDate": "2021-02-03T00:00:00",
  "InvoiceDate": null,
  "Supplier": "RF Composites Pty Ltd",
  "SupplierID": "e5f1f4a0-c501-45a0-960a-9a851bdc0e7a",
  "InvoiceNumber": "",
  "InvoiceAmount": 19,
  "PaidAmount": 0,
  "InvoiceDueDate": null,
  "RequiredBy": "2021-02-28T00:00:00",
  "BaseCurrency": "AUD",
  "SupplierCurrency": "AUD",
  "CreditNoteNumber": "",
  "OrderStatus": "RECEIVED",
  "StockReceivedStatus": "AUTHORISED",
  "UnstockStatus": "NOT AVAILABLE",
  "InvoiceStatus": "DRAFT",
  "CreditNoteStatus": "NOT AVAILABLE",
  "LastUpdatedDate": "2022-02-10T06:43:38.833",
  "Type": "Advanced Purchase",
  "CombinedInvoiceStatus": "NOT INVOICED",
  "CombinedPaymentStatus": "UNPAID",
  "CombinedReceivingStatus": "FULLY RECEIVED",
  "IsServiceOnly": false,
  "DropShipTaskID": null
}
```
</details>

---

## StockAdjustment

**URL:** `/stockAdjustment?Page=1&Limit=5`

**Status:** 400
**Total Records:** 1
**Notes:** List key: root | Record count on page: 1

### Fields

| Field | Type | Sample Value |
|-------|------|-------------|
| ErrorCode | number | 400 |
| Exception | string | Stock Adjustment with specified TaskID not found |

<details><summary>Full sample record JSON</summary>

```json
{
  "ErrorCode": 400,
  "Exception": "Stock Adjustment with specified TaskID not found"
}
```
</details>

---

## StockTransfer

**URL:** `/stockTransfer?Page=1&Limit=5`

**Status:** 400
**Total Records:** 1
**Notes:** List key: root | Record count on page: 1

### Fields

| Field | Type | Sample Value |
|-------|------|-------------|
| ErrorCode | number | 400 |
| Exception | string | Stock Transfer with specified ID not found |

<details><summary>Full sample record JSON</summary>

```json
{
  "ErrorCode": 400,
  "Exception": "Stock Transfer with specified ID not found"
}
```
</details>

---

## Product Detail (single)

**URL:** `/product?ID=d25af813-cfb8-4aaa-994f-17adab269b1a`

**Status:** 200
**Total Records:** 1
**Notes:** List key: Products | Record count on page: 1

### Fields

| Field | Type | Sample Value |
|-------|------|-------------|
| ID | string | d25af813-cfb8-4aaa-994f-17adab269b1a |
| SKU | string | $100discount coupon discount |
| Name | string | $100discount coupon discount |
| Category | string | Raw Material |
| Brand | null | null |
| Type | string | Service |
| CostingMethod | string | FIFO |
| DropShipMode | string | No Drop Ship |
| DefaultLocation | string | Banyo Head Office |
| Length | number | 0 |
| Width | number | 0 |
| Height | number | 0 |
| Weight | number | 0 |
| UOM | string | Each |
| WeightUnits | string |  |
| DimensionsUnits | string |  |
| Barcode | null | null |
| MinimumBeforeReorder | number | 0 |
| ReorderQuantity | number | 0 |
| PriceTier1 | number | -100 |
| PriceTier2 | number | 0 |
| PriceTier3 | number | 0 |
| PriceTier4 | number | 0 |
| PriceTier5 | number | 0 |
| PriceTier6 | number | 0 |
| PriceTier7 | number | 0 |
| PriceTier8 | number | 0 |
| PriceTier9 | number | 0 |
| PriceTier10 | number | 0 |
| PriceTiers | object | {"RRP":-100,"Sale Price on Website":0,"Distributer":0,"Training":0,"Distributer Bulk":0,"Trade C":0, |
| AverageCost | number | 0 |
| ShortDescription | null | null |
| InternalNote | null | null |
| Description | null | null |
| AdditionalAttribute1 | null | null |
| AdditionalAttribute2 | null | null |
| AdditionalAttribute3 | null | null |
| AdditionalAttribute4 | null | null |
| AdditionalAttribute5 | null | null |
| AdditionalAttribute6 | null | null |
| AdditionalAttribute7 | null | null |
| AdditionalAttribute8 | null | null |
| AdditionalAttribute9 | null | null |
| AdditionalAttribute10 | null | null |
| AttributeSet | string | Raw Material |
| DiscountRule | null | null |
| Tags | null | null |
| Status | string | Active |
| StockLocator | null | null |
| COGSAccount | null | null |
| RevenueAccount | null | null |
| ExpenseAccount | null | null |
| InventoryAccount | null | null |
| PurchaseTaxRule | null | null |
| SaleTaxRule | null | null |
| LastModifiedOn | string | 2024-08-18T11:43:38.777Z |
| Sellable | boolean | true |
| PickZones | null | null |
| BillOfMaterial | boolean | false |
| AutoAssembly | boolean | false |
| AutoDisassembly | boolean | false |
| QuantityToProduce | number | 1 |
| AlwaysShowQuantity | null | null |
| AssemblyInstructionURL | null | null |
| AssemblyCostEstimationMethod | string | Average Cost |
| Suppliers | array[0] | [] |
| ReorderLevels | array[0] | [] |
| BillOfMaterialsProducts | array[0] | [] |
| BillOfMaterialsServices | array[0] | [] |
| Movements | array[0] | [] |
| Attachments | array[0] | [] |
| BOMType | string | None |
| WarrantyName | null | null |
| CustomPrices | array[0] | [] |
| CartonHeight | null | null |
| CartonWidth | null | null |
| CartonLength | null | null |
| CartonQuantity | null | null |
| CartonInnerQuantity | null | null |
| HSCode | null | null |
| CountryOfOrigin | null | null |
| CountryOfOriginCode | null | null |
| CreatedDate | string | 2024-08-18T11:43:38.787 |

<details><summary>Full sample record JSON</summary>

```json
{
  "ID": "d25af813-cfb8-4aaa-994f-17adab269b1a",
  "SKU": "$100discount coupon discount",
  "Name": "$100discount coupon discount",
  "Category": "Raw Material",
  "Brand": null,
  "Type": "Service",
  "CostingMethod": "FIFO",
  "DropShipMode": "No Drop Ship",
  "DefaultLocation": "Banyo Head Office",
  "Length": 0,
  "Width": 0,
  "Height": 0,
  "Weight": 0,
  "UOM": "Each",
  "WeightUnits": "",
  "DimensionsUnits": "",
  "Barcode": null,
  "MinimumBeforeReorder": 0,
  "ReorderQuantity": 0,
  "PriceTier1": -100,
  "PriceTier2": 0,
  "PriceTier3": 0,
  "PriceTier4": 0,
  "PriceTier5": 0,
  "PriceTier6": 0,
  "PriceTier7": 0,
  "PriceTier8": 0,
  "PriceTier9": 0,
  "PriceTier10": 0,
  "PriceTiers": {
    "RRP": -100,
    "Sale Price on Website": 0,
    "Distributer": 0,
    "Training": 0,
    "Distributer Bulk": 0,
    "Trade C": 0,
    "Trade D": 0,
    "Trade E": 0,
    "Trade F": 0,
    "Trade G": 0
  },
  "AverageCost": 0,
  "ShortDescription": null,
  "InternalNote": null,
  "Description": null,
  "AdditionalAttribute1": null,
  "AdditionalAttribute2": null,
  "AdditionalAttribute3": null,
  "AdditionalAttribute4": null,
  "AdditionalAttribute5": null,
  "AdditionalAttribute6": null,
  "AdditionalAttribute7": null,
  "AdditionalAttribute8": null,
  "AdditionalAttribute9": null,
  "AdditionalAttribute10": null,
  "AttributeSet": "Raw Material",
  "DiscountRule": null,
  "Tags": null,
  "Status": "Active",
  "StockLocator": null,
  "COGSAccount": null,
  "RevenueAccount": null,
  "ExpenseAccount": null,
  "InventoryAccount": null,
  "PurchaseTaxRule": null,
  "SaleTaxRule": null,
  "LastModifiedOn": "2024-08-18T11:43:38.777Z",
  "Sellable": true,
  "PickZones": null,
  "BillOfMaterial": false,
  "AutoAssembly": false,
  "AutoDisassembly": false,
  "QuantityToProduce": 1,
  "AlwaysShowQuantity": null,
  "AssemblyInstructionURL": null,
  "AssemblyCostEstimationMethod": "Average Cost",
  "Suppliers": [],
  "ReorderLevels": [],
  "BillOfMaterialsProducts": [],
  "BillOfMaterialsServices": [],
  "Movements": [],
  "Attachments": [],
  "BOMType": "None",
  "WarrantyName": null,
  "CustomPrices": [],
  "CartonHeight": null,
  "CartonWidth": null,
  "CartonLength": null,
  "CartonQuantity": null,
  "CartonInnerQuantity": null,
  "HSCode": null,
  "CountryOfOrigin": null,
  "CountryOfOriginCode": null,
  "CreatedDate": "2024-08-18T11:43:38.787"
}
```
</details>

---

