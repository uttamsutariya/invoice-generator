import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { getInvoiceById, getSignature } from "../utils/storage";
import { formatDate, getCurrencyByCode, numberToWords, numberToWordsInternational } from "../utils/helpers";

export default function InvoicePreview() {
	const { id } = useParams();
	const navigate = useNavigate();
	const printRef = useRef();
	const [invoice, setInvoice] = useState(null);
	const [signature, setSignature] = useState(null);

	useEffect(() => {
		const inv = getInvoiceById(id);
		if (inv) setInvoice(inv);
		else navigate("/");
		setSignature(getSignature());
	}, [id, navigate]);

	if (!invoice) return null;

	const currency = getCurrencyByCode(invoice.currency);
	const convRate = parseFloat(invoice.conversionRate) || 0;

	const lineItemsCalc = invoice.lineItems.map((item) => {
		const amount = parseFloat(item.amount) || 0;
		const igstRate = parseFloat(item.igstRate) || 0;
		const igstAmount = (amount * igstRate) / 100;
		const total = amount + igstAmount;
		return { ...item, amount, igstRate, igstAmount, total };
	});

	const totalAmount = lineItemsCalc.reduce((sum, i) => sum + i.amount, 0);
	const totalIgst = lineItemsCalc.reduce((sum, i) => sum + i.igstAmount, 0);
	const totalBillForeign = totalAmount + totalIgst;
	const totalBillINR = totalBillForeign * convRate;

	// Group SAC codes for tax breakdown
	const sacGroups = {};
	lineItemsCalc.forEach((item) => {
		const key = item.sacCode || "N/A";
		if (!sacGroups[key]) sacGroups[key] = { taxableValue: 0, igstRate: item.igstRate, igstAmount: 0 };
		sacGroups[key].taxableValue += item.amount;
		sacGroups[key].igstAmount += item.igstAmount;
	});

	const handleDownloadPDF = async () => {
		const element = printRef.current;
		const html2pdf = (await import("html2pdf.js")).default;
		html2pdf()
			.set({
				margin: [10, 10, 10, 10],
				filename: `${invoice.invoiceNo.replace(/\//g, "-")}.pdf`,
				image: { type: "jpeg", quality: 0.98 },
				html2canvas: { scale: 2, useCORS: true },
				jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
			})
			.from(element)
			.save();
	};

	return (
		<div className="page">
			<div className="page-header no-print">
				<h2>Invoice Preview</h2>
				<div className="page-actions">
					<button className="btn" onClick={() => navigate("/")}>
						Back
					</button>
					<button className="btn" onClick={() => navigate(`/invoice/${id}/edit`)}>
						Edit
					</button>
					<button className="btn btn-primary" onClick={handleDownloadPDF}>
						Download PDF
					</button>
				</div>
			</div>

			<div className="invoice-preview" ref={printRef}>
				<table className="inv-outer">
					<tbody>
						{/* Header */}
						<tr>
							<td colSpan="4" className="inv-header">
								<div className="inv-title">
									{invoice.invoiceNo.includes("EX") ? "Export Invoice" : "Export Invoice"}
								</div>
								<div className="inv-subtitle">
									(SUPPLY MEANT FOR EXPORT/SUPPLY TO SEZ UNIT OR SEZ DEVELOPER FOR AUTHORISED OPERATIONS UNDER BOND OR
									LETTER OF UNDERTAKING WITHOUT PAYMENT OF IGST)
								</div>
							</td>
						</tr>

						{/* Company + Invoice Meta */}
						<tr>
							<td colSpan="2" className="inv-company">
								<div className="inv-company-name">{invoice.company.name}</div>
								<div>{invoice.company.address}</div>
								{invoice.company.gstin && <div>GSTIN: {invoice.company.gstin}</div>}
								<div>
									State Name: {invoice.state}, Code: {invoice.stateCode}
								</div>
							</td>
							<td colSpan="2" className="inv-meta">
								<table className="inv-meta-table">
									<tbody>
										<tr>
											<td>Invoice No.</td>
											<td>{invoice.invoiceNo}</td>
										</tr>
										<tr>
											<td>Dated</td>
											<td>{formatDate(invoice.invoiceDate)}</td>
										</tr>
										<tr>
											<td>Country</td>
											<td>{invoice.placeOfSupply}</td>
										</tr>
										{invoice.lutBondNo && (
											<tr>
												<td>LUT/Bond No.</td>
												<td>
													{invoice.lutBondNo}
													{invoice.lutFrom && invoice.lutTo && (
														<div style={{ fontSize: "0.85em" }}>
															From: {formatDate(invoice.lutFrom)} To: {formatDate(invoice.lutTo)}
														</div>
													)}
												</td>
											</tr>
										)}
									</tbody>
								</table>
							</td>
						</tr>

						{/* Buyer */}
						<tr>
							<td colSpan="4" className="inv-section-label">
								Buyer (Bill to)
							</td>
						</tr>
						<tr>
							<td colSpan="4" className="inv-buyer">
								<div>
									<strong>{invoice.client.name}</strong>
								</div>
								<div>{invoice.client.address}</div>
								{invoice.client.country && <div>{invoice.client.country}</div>}
							</td>
						</tr>

						{/* Line Items Header */}
						<tr className="inv-items-header">
							<th style={{ width: "40px" }}>
								SI
								<br />
								No.
							</th>
							<th>Particulars</th>
							<th style={{ width: "80px" }}>SAC</th>
							<th style={{ width: "120px" }}>Amount</th>
						</tr>

						{/* Line Items */}
						{lineItemsCalc.map((item, idx) => (
							<tr key={item.id} className="inv-item-row">
								<td className="center">{idx + 1}</td>
								<td>
									<strong>{item.description}</strong>
									{item.details && (
										<div className="item-details">
											{item.details.split("\n").map((line, i) => (
												<div key={i}>{line}</div>
											))}
										</div>
									)}
								</td>
								<td className="center">{item.sacCode}</td>
								<td className="right">
									{currency.symbol} {item.amount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
								</td>
							</tr>
						))}

						{/* Empty rows to fill space */}
						{Array.from({ length: Math.max(0, 8 - lineItemsCalc.length) }).map((_, idx) => (
							<tr key={`empty-${idx}`} className="inv-item-row inv-empty-row">
								<td>&nbsp;</td>
								<td>&nbsp;</td>
								<td>&nbsp;</td>
								<td>&nbsp;</td>
							</tr>
						))}

						{/* Total Row */}
						<tr className="inv-total-row">
							<td></td>
							<td className="right">
								<strong>Total</strong>
							</td>
							<td></td>
							<td className="right">
								<strong>
									{currency.symbol} {totalBillForeign.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
								</strong>
							</td>
						</tr>

						{/* Amount in words */}
						<tr>
							<td colSpan="4" className="inv-amount-words">
								<div>Amount Chargeable (in words)</div>
								<div>
									<strong>{numberToWordsInternational(totalBillForeign, currency.name)}</strong>
								</div>
							</td>
						</tr>

						{/* E. & O.E. */}
						<tr>
							<td colSpan="4" className="right" style={{ fontSize: "0.8em", border: "none", padding: "2px 8px" }}>
								E. &amp; O.E
							</td>
						</tr>

						{/* Tax Breakdown Header */}
						<tr className="inv-tax-header">
							<th>SAC</th>
							<th>Taxable Value</th>
							<th>IGST Rate</th>
							<th>IGST Amount</th>
						</tr>

						{/* Tax Breakdown Rows */}
						{Object.entries(sacGroups).map(([code, data]) => (
							<tr key={code} className="inv-tax-row">
								<td>{code}</td>
								<td className="right">{data.taxableValue.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</td>
								<td className="center">{data.igstRate}%</td>
								<td className="right">{data.igstAmount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</td>
							</tr>
						))}

						<tr className="inv-tax-total">
							<td>
								<strong>Total</strong>
							</td>
							<td className="right">
								<strong>{totalAmount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</strong>
							</td>
							<td></td>
							<td className="right">
								<strong>{totalIgst.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</strong>
							</td>
						</tr>

						{/* Tax Amount in Words */}
						<tr>
							<td colSpan="2" className="inv-tax-words">
								Total Amount (in words): INR <strong>{convRate ? "Rupees " + numberToWords(totalBillINR) + " Only" : "—"}</strong>
							</td>
							<td colSpan="2" className="inv-bank-section">
								<div>
									<strong>Company's Bank Details</strong>
								</div>
								{invoice.company.bankName && <div>Bank Name: {invoice.company.bankName}</div>}
								{invoice.company.bankAccount && <div>A/c No.: {invoice.company.bankAccount}</div>}
								{invoice.company.bankBranch && invoice.company.bankIfsc && (
									<div>
										Branch &amp; IFS Code: {invoice.company.bankBranch}, {invoice.company.bankIfsc}
									</div>
								)}
							</td>
						</tr>

						{/* Conversion + Summary */}
						<tr>
							<td colSpan="2" className="inv-conversion">
								<table className="inv-summary-table">
									<tbody>
										<tr>
											<td>Total Amount before Tax</td>
											<td className="right">
												{currency.symbol} {totalAmount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
											</td>
										</tr>
										<tr>
											<td>Add: IGST</td>
											<td className="right">
												{currency.symbol} {totalIgst.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
											</td>
										</tr>
										<tr>
											<td>
												<strong>Total Bill Amount in {currency.code}</strong>
											</td>
											<td className="right">
												<strong>
													{currency.symbol} {totalBillForeign.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
												</strong>
											</td>
										</tr>
										<tr>
											<td>Total Bill Amount in Rs.</td>
											<td className="right">
												Rs. {totalBillINR.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
											</td>
										</tr>
										<tr>
											<td colSpan="2">
												<strong>
													Conversion Rate (1 {currency.code} = INR {convRate || "—"})
												</strong>
											</td>
										</tr>
									</tbody>
								</table>
							</td>
							<td colSpan="2" className="inv-signatory">
								<div>
									for <strong>{invoice.company.name}</strong>
								</div>
								<div className="inv-sig-space">
									{signature && <img src={signature} alt="Signature" className="inv-sig-img" />}
								</div>
								<div>Authorised Signatory</div>
							</td>
						</tr>

						{/* PAN/IEC */}
						{invoice.company.panIec && (
							<tr>
								<td colSpan="2" className="inv-pan">
									Company's PAN/IEC Code: <strong>{invoice.company.panIec}</strong>
								</td>
								<td colSpan="2"></td>
							</tr>
						)}

						{/* Footer */}
						<tr>
							<td colSpan="4" className="inv-footer">
								<div>SUBJECT TO AHMEDABAD JURISDICTION</div>
								<div>This is a Computer Generated Invoice</div>
							</td>
						</tr>
					</tbody>
				</table>
			</div>
		</div>
	);
}
