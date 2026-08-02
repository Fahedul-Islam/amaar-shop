// Package pdf provides a thin, opinionated wrapper around gofpdf for
// building AmaarShop invoices and seller-export reports. Keeping the
// styling in one place means every PDF the platform generates looks
// consistent — same fonts, same margins, same brand color.
package pdf

import (
	"bytes"
	"fmt"

	"github.com/jung-kurt/gofpdf"
)

// Brand colors (RGB) — match the teal/stone palette used in the web UI.
var (
	colorTeal     = rgb{13, 148, 136}
	colorStone900 = rgb{28, 25, 23}
	colorStone600 = rgb{87, 83, 78}
	colorStone400 = rgb{168, 162, 158}
	colorStone100 = rgb{245, 245, 244}
)

type rgb struct{ R, G, B int }

// Doc wraps a single PDF document being built. It owns the underlying
// gofpdf.Pdf and exposes high-level helpers.
type Doc struct {
	pdf *gofpdf.Fpdf
}

// New starts a new A4 portrait document with consistent margins.
func New() *Doc {
	pdf := gofpdf.New("P", "mm", "A4", "")
	pdf.SetMargins(15, 15, 15)
	pdf.SetAutoPageBreak(true, 18)
	pdf.AddPage()
	pdf.SetFont("Helvetica", "", 11)
	return &Doc{pdf: pdf}
}

// Header renders the AmaarShop wordmark + a short tagline at the top.
// Call this once near the start of the document.
func (d *Doc) Header(rightLine1, rightLine2 string) {
	d.pdf.SetFont("Helvetica", "B", 18)
	d.pdf.SetTextColor(colorTeal.R, colorTeal.G, colorTeal.B)
	d.pdf.Text(15, 20, "amaar")
	w := d.pdf.GetStringWidth("amaar")
	d.pdf.SetTextColor(colorStone900.R, colorStone900.G, colorStone900.B)
	d.pdf.Text(15+w, 20, "shop")

	d.pdf.SetFont("Helvetica", "", 9)
	d.pdf.SetTextColor(colorStone400.R, colorStone400.G, colorStone400.B)
	d.pdf.Text(15, 26, "amaarshop.com")

	if rightLine1 != "" {
		d.pdf.SetFont("Helvetica", "B", 11)
		d.pdf.SetTextColor(colorStone900.R, colorStone900.G, colorStone900.B)
		// Right-align by computing string width from the right margin.
		pageW, _ := d.pdf.GetPageSize()
		x := pageW - 15 - d.pdf.GetStringWidth(rightLine1)
		d.pdf.Text(x, 20, rightLine1)
	}
	if rightLine2 != "" {
		d.pdf.SetFont("Helvetica", "", 9)
		d.pdf.SetTextColor(colorStone600.R, colorStone600.G, colorStone600.B)
		pageW, _ := d.pdf.GetPageSize()
		x := pageW - 15 - d.pdf.GetStringWidth(rightLine2)
		d.pdf.Text(x, 26, rightLine2)
	}

	// Hairline under header.
	d.pdf.SetDrawColor(colorStone100.R, colorStone100.G, colorStone100.B)
	d.pdf.Line(15, 32, 195, 32)
	d.pdf.SetY(38)
	d.pdf.SetTextColor(colorStone900.R, colorStone900.G, colorStone900.B)
}

// SectionTitle writes a small uppercase label, the visual equivalent of
// "Bill to" / "Order details".
func (d *Doc) SectionTitle(s string) {
	d.pdf.SetFont("Helvetica", "B", 9)
	d.pdf.SetTextColor(colorStone400.R, colorStone400.G, colorStone400.B)
	d.pdf.CellFormat(0, 6, s, "", 1, "L", false, 0, "")
}

// H1 writes a page heading.
func (d *Doc) H1(s string) {
	d.pdf.SetFont("Helvetica", "B", 18)
	d.pdf.SetTextColor(colorStone900.R, colorStone900.G, colorStone900.B)
	d.pdf.CellFormat(0, 9, s, "", 1, "L", false, 0, "")
	d.pdf.Ln(2)
}

// H2 writes a section heading.
func (d *Doc) H2(s string) {
	d.pdf.SetFont("Helvetica", "B", 13)
	d.pdf.SetTextColor(colorStone900.R, colorStone900.G, colorStone900.B)
	d.pdf.CellFormat(0, 7, s, "", 1, "L", false, 0, "")
	d.pdf.Ln(1)
}

// Body writes a block of normal text.
func (d *Doc) Body(s string) {
	d.pdf.SetFont("Helvetica", "", 11)
	d.pdf.SetTextColor(colorStone600.R, colorStone600.G, colorStone600.B)
	d.pdf.MultiCell(0, 5, s, "", "L", false)
}

// KV renders a "key: value" line where the key is muted and value is bold.
func (d *Doc) KV(key, value string) {
	d.pdf.SetFont("Helvetica", "", 10)
	d.pdf.SetTextColor(colorStone600.R, colorStone600.G, colorStone600.B)
	d.pdf.CellFormat(40, 6, key, "", 0, "L", false, 0, "")
	d.pdf.SetFont("Helvetica", "B", 10)
	d.pdf.SetTextColor(colorStone900.R, colorStone900.G, colorStone900.B)
	d.pdf.CellFormat(0, 6, value, "", 1, "L", false, 0, "")
}

// Spacer drops vertical space.
func (d *Doc) Spacer(mm float64) {
	d.pdf.Ln(mm)
}

// Column describes one column in a Table.
type Column struct {
	Header string
	// Width in mm. Use 0 for any column to mean "fill remaining space"
	// (only one such column is supported per table).
	Width float64
	Align string // "L", "R", "C"
}

// Table renders a striped table with a teal header bar.
//
//	columns: header definitions
//	rows:    each row is one slice of strings, same length as columns
func (d *Doc) Table(columns []Column, rows [][]string) {
	pageW, _ := d.pdf.GetPageSize()
	usableW := pageW - 30

	// Resolve any zero-width column to fill remaining space.
	widths := make([]float64, len(columns))
	used := 0.0
	zeroIdx := -1
	for i, c := range columns {
		if c.Width == 0 {
			zeroIdx = i
		} else {
			widths[i] = c.Width
			used += c.Width
		}
	}
	if zeroIdx >= 0 {
		widths[zeroIdx] = usableW - used
	}

	// Header
	d.pdf.SetFillColor(colorTeal.R, colorTeal.G, colorTeal.B)
	d.pdf.SetTextColor(255, 255, 255)
	d.pdf.SetFont("Helvetica", "B", 9)
	for i, c := range columns {
		align := c.Align
		if align == "" {
			align = "L"
		}
		d.pdf.CellFormat(widths[i], 8, c.Header, "", 0, align, true, 0, "")
	}
	d.pdf.Ln(-1)

	// Rows
	d.pdf.SetFont("Helvetica", "", 10)
	d.pdf.SetTextColor(colorStone900.R, colorStone900.G, colorStone900.B)
	for ri, row := range rows {
		fill := ri%2 == 1
		if fill {
			d.pdf.SetFillColor(colorStone100.R, colorStone100.G, colorStone100.B)
		}
		// Compute the tallest cell needed (multi-line safe for long text).
		maxLines := 1
		for ci, val := range row {
			lines := d.pdf.SplitLines([]byte(val), widths[ci]-2)
			if len(lines) > maxLines {
				maxLines = len(lines)
			}
		}
		rowH := float64(maxLines) * 5
		if rowH < 7 {
			rowH = 7
		}

		// Draw with fill if striped.
		x := d.pdf.GetX()
		y := d.pdf.GetY()
		for ci, val := range row {
			align := columns[ci].Align
			if align == "" {
				align = "L"
			}
			d.pdf.SetXY(x, y)
			d.pdf.CellFormat(widths[ci], rowH, val, "", 0, align, fill, 0, "")
			x += widths[ci]
		}
		d.pdf.Ln(rowH)
	}
}

// TotalsBlock renders a right-aligned totals box (subtotal/delivery/total).
// Pass [][]string{ {"Subtotal","৳1,200"}, {"Delivery","৳60"}, {"Total","৳1,260"} }.
// The last row is rendered bold as the grand total.
func (d *Doc) TotalsBlock(rows [][]string) {
	pageW, _ := d.pdf.GetPageSize()
	xStart := pageW - 15 - 70 // 70mm wide totals box on the right
	d.pdf.SetX(xStart)

	for i, row := range rows {
		isLast := i == len(rows)-1
		d.pdf.SetX(xStart)
		if isLast {
			d.pdf.SetFont("Helvetica", "B", 11)
			d.pdf.SetTextColor(colorStone900.R, colorStone900.G, colorStone900.B)
			// Top border on grand total row.
			d.pdf.SetDrawColor(colorStone400.R, colorStone400.G, colorStone400.B)
			d.pdf.Line(xStart, d.pdf.GetY(), xStart+70, d.pdf.GetY())
			d.pdf.Ln(1.5)
			d.pdf.SetX(xStart)
		} else {
			d.pdf.SetFont("Helvetica", "", 10)
			d.pdf.SetTextColor(colorStone600.R, colorStone600.G, colorStone600.B)
		}
		d.pdf.CellFormat(35, 6, row[0], "", 0, "L", false, 0, "")
		d.pdf.CellFormat(35, 6, row[1], "", 1, "R", false, 0, "")
	}
}

// Footer writes a small thank-you / contact line at the bottom of the page.
func (d *Doc) Footer(line1, line2 string) {
	pageW, pageH := d.pdf.GetPageSize()
	d.pdf.SetY(pageH - 18)
	d.pdf.SetDrawColor(colorStone100.R, colorStone100.G, colorStone100.B)
	d.pdf.Line(15, d.pdf.GetY(), pageW-15, d.pdf.GetY())
	d.pdf.Ln(2)
	d.pdf.SetFont("Helvetica", "", 9)
	d.pdf.SetTextColor(colorStone400.R, colorStone400.G, colorStone400.B)
	d.pdf.CellFormat(0, 4, line1, "", 1, "C", false, 0, "")
	d.pdf.CellFormat(0, 4, line2, "", 1, "C", false, 0, "")
}

// Bytes finalizes the PDF and returns the encoded byte slice.
func (d *Doc) Bytes() ([]byte, error) {
	var buf bytes.Buffer
	if err := d.pdf.Output(&buf); err != nil {
		return nil, fmt.Errorf("pdf output: %w", err)
	}
	return buf.Bytes(), nil
}
