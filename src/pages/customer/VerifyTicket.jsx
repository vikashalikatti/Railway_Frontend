import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import Card from 'react-bootstrap/Card';
import Table from 'react-bootstrap/Table';
import { customerApi } from '../../api.js';
import { useAction } from '../../session.jsx';

/** Opened by scanning an e-ticket's QR code: shows whether the ticket is genuine and its live status */
export default function VerifyTicket() {
  const [params] = useSearchParams();
  const code = params.get('code') || '';
  const load = useAction();
  const [check, setCheck] = useState(null);

  useEffect(() => {
    if (!code) return;
    load.run(async () => setCheck((await customerApi.verifyTicket(code)).data2));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code]);

  return (
    <div className="container py-4" style={{ maxWidth: 720 }}>
      <Card className="shadow-sm">
        <Card.Body className="p-4 vstack gap-3">
          <h1 className="h4 mb-0">
            <i className="bi bi-qr-code-scan text-accent me-2" aria-hidden="true" />
            Ticket check
          </h1>
          {!code && <p className="mb-0 text-secondary">Scan the QR code on an e-ticket to check it.</p>}
          {load.busy && <p className="mb-0 text-secondary">Checking…</p>}
          {check && (
            <>
              <div className={`verify-result ${check.valid ? 'ok' : 'bad'}`} role="status">
                <i className={`bi ${check.valid ? 'bi-patch-check-fill' : 'bi-x-octagon-fill'} me-2`} aria-hidden="true" />
                {check.message}
              </div>
              {check.pnr && check.trainNumber && (
                <>
                  <dl className="verify-grid mb-0">
                    <div>
                      <dt>PNR</dt>
                      <dd>{check.pnr}</dd>
                    </div>
                    <div>
                      <dt>Train</dt>
                      <dd>
                        {check.trainNumber} {check.trainName}
                      </dd>
                    </div>
                    <div>
                      <dt>Journey</dt>
                      <dd>
                        {check.from} to {check.to}
                      </dd>
                    </div>
                    <div>
                      <dt>Departs</dt>
                      <dd>{check.departs || check.boardingDate}</dd>
                    </div>
                    <div>
                      <dt>Class</dt>
                      <dd>{check.classLabel}</dd>
                    </div>
                  </dl>
                  <Table responsive size="sm" className="mb-0">
                    <thead className="table-light">
                      <tr>
                        <th scope="col">#</th>
                        <th scope="col">Name</th>
                        <th scope="col">Age</th>
                        <th scope="col">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {check.passengers.map((p) => (
                        <tr key={p.no}>
                          <td>{p.no}</td>
                          <td>
                            {p.name}
                            <span className="d-block small text-secondary">{p.gender}</span>
                          </td>
                          <td>{p.age}</td>
                          <td>{p.status}</td>
                        </tr>
                      ))}
                    </tbody>
                  </Table>
                  <p className="small text-secondary mb-0">Ask for a photo ID that matches one of these passengers.</p>
                </>
              )}
            </>
          )}
        </Card.Body>
      </Card>
    </div>
  );
}
