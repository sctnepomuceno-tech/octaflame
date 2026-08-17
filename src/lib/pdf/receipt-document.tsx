import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";

import { formatCount, formatCurrency, formatKg } from "@/lib/volume/format";
import type { Database } from "@/lib/supabase/database.types";

type Sale = Database["public"]["Tables"]["sales"]["Row"];

export interface ReceiptItem {
  id: string;
  productName: string;
  qty_crates: number;
  qty_canisters: number;
  qty_sets: number;
  unit_price: number;
  line_total: number;
  notes: string | null;
}

const styles = StyleSheet.create({
  page: { padding: 36, fontSize: 10, fontFamily: "Helvetica" },
  headerRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 12 },
  companyName: { fontSize: 16, fontWeight: 700 },
  muted: { color: "#666666" },
  section: { marginTop: 10, marginBottom: 10 },
  divider: { borderBottomWidth: 1, borderBottomColor: "#e5e5e5", marginVertical: 10 },
  row: { flexDirection: "row", justifyContent: "space-between" },
  tableHeader: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: "#999", paddingBottom: 4, marginBottom: 4 },
  tableRow: { flexDirection: "row", paddingVertical: 3, borderBottomWidth: 0.5, borderBottomColor: "#eee" },
  colItem: { width: "40%" },
  colQty: { width: "20%", textAlign: "right" },
  colPrice: { width: "20%", textAlign: "right" },
  colTotal: { width: "20%", textAlign: "right" },
  totalsBlock: { alignItems: "flex-end", marginTop: 10 },
  totalRow: { flexDirection: "row", width: 180, justifyContent: "space-between", marginBottom: 2 },
  grandTotal: { fontSize: 12, fontWeight: 700 },
  signature: { marginTop: 48, alignSelf: "flex-end", width: 180, borderTopWidth: 1, borderTopColor: "#999", paddingTop: 4, textAlign: "center", color: "#666" },
});

function qtyLabel(item: ReceiptItem): string {
  if (item.qty_sets > 0) return `${item.qty_sets} set${item.qty_sets === 1 ? "" : "s"}`;
  if (item.qty_crates > 0) return `${item.qty_crates} crate${item.qty_crates === 1 ? "" : "s"}`;
  return `${item.qty_canisters}`;
}

export function ReceiptDocument({
  sale,
  items,
  customerName,
  customerAddress,
  customerContact,
  dspName,
  municipalityName,
}: {
  sale: Sale;
  items: ReceiptItem[];
  customerName: string;
  customerAddress: string | null;
  customerContact: string | null;
  dspName: string;
  municipalityName: string;
}) {
  return (
    <Document title={`Receipt ${sale.receipt_no}`}>
      <Page size="A5" style={styles.page}>
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.companyName}>Octaflame</Text>
            <Text style={styles.muted}>Fiesta Gas Distributor - Sorsogon</Text>
          </View>
          <View>
            <Text>{sale.receipt_no}</Text>
            <Text style={styles.muted}>{sale.sale_date}</Text>
            <Text style={styles.muted}>{dspName}</Text>
          </View>
        </View>

        <View style={styles.divider} />

        <View style={styles.row}>
          <View>
            <Text style={styles.muted}>Customer</Text>
            <Text>{customerName}</Text>
            {customerContact ? <Text>{customerContact}</Text> : null}
            {customerAddress ? <Text style={styles.muted}>{customerAddress}</Text> : null}
          </View>
          <View>
            <Text style={styles.muted}>Municipality</Text>
            <Text>{municipalityName}</Text>
          </View>
        </View>

        <View style={styles.divider} />

        <View style={styles.tableHeader}>
          <Text style={styles.colItem}>Item</Text>
          <Text style={styles.colQty}>Qty</Text>
          <Text style={styles.colPrice}>Price</Text>
          <Text style={styles.colTotal}>Total</Text>
        </View>
        {items.map((item) => (
          <View key={item.id} style={styles.tableRow}>
            <Text style={styles.colItem}>{item.productName}</Text>
            <Text style={styles.colQty}>{qtyLabel(item)}</Text>
            <Text style={styles.colPrice}>{formatCurrency(item.unit_price)}</Text>
            <Text style={styles.colTotal}>{formatCurrency(item.line_total)}</Text>
          </View>
        ))}

        <View style={styles.totalsBlock}>
          <View style={styles.totalRow}>
            <Text style={styles.muted}>Volume</Text>
            <Text>{formatKg(sale.total_volume_kg)}</Text>
          </View>
          <View style={styles.totalRow}>
            <Text style={styles.grandTotal}>Total</Text>
            <Text style={styles.grandTotal}>{formatCurrency(sale.total_amount)}</Text>
          </View>
        </View>

        {sale.empties_expected > 0 ? (
          <View style={styles.section}>
            <View style={styles.row}>
              <Text style={styles.muted}>Empties collected</Text>
              <Text>{formatCount(sale.empties_collected)}</Text>
            </View>
            {sale.empties_variance > 0 ? (
              <View style={styles.row}>
                <Text style={styles.muted}>Still owed</Text>
                <Text>{formatCount(sale.empties_variance)}</Text>
              </View>
            ) : null}
          </View>
        ) : null}

        <View style={styles.row}>
          <Text>Payment: {sale.payment_status.toUpperCase()}</Text>
        </View>

        {sale.notes ? <Text style={[styles.muted, styles.section]}>{sale.notes}</Text> : null}

        <Text style={styles.signature}>Customer signature</Text>
      </Page>
    </Document>
  );
}
