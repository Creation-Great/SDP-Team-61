import { Router } from 'express';
import { withDb } from '../db';
import { audit } from '../utils/audit';
import asyncHandler from 'express-async-handler';

const router = Router();

router.get('/v1/by-submission/:id', asyncHandler(async (req, res) => {
  const { user_id, role } = (req as any).user;
  const { id: submission_id } = req.params;
  const { include_canceled } = req.query;

  const result = await withDb(user_id, role, async (client) => {
    const query = `
      SELECT 
        a.assignment_id,
        a.submission_id,
        a.reviewer_id,
        a.strategy,
        a.score,
        a.cost_vector,
        a.fairness_snapshot,
        a.status,
        a.created_at,
        u.netid AS reviewer_netid,
        u.role AS reviewer_role,
        u.group_id AS reviewer_group,
        r.review_id,
        r.created_at AS review_created_at,
        rs.adopted AS suggestion_adopted
      FROM assignments a
      LEFT JOIN users u ON u.user_id = a.reviewer_id
      LEFT JOIN reviews r ON r.submission_id = a.submission_id AND r.reviewer_id = a.reviewer_id
      LEFT JOIN rewrite_suggestions rs ON rs.review_id = r.review_id
      WHERE a.submission_id = $1
        AND (a.status <> 'canceled' OR $2::boolean = true)
      ORDER BY a.created_at DESC, a.strategy NULLS LAST
    `;

    const { rows } = await client.query(query, [submission_id, include_canceled === 'true']);

    const assignees = rows.map((row: any) => ({
      assignment_id: row.assignment_id,
      reviewer_id: row.reviewer_id,
      reviewer_netid: row.reviewer_netid,
      reviewer_role: row.reviewer_role,
      reviewer_group: row.reviewer_group,
      strategy: row.strategy,
      score: row.score ? parseFloat(row.score) : null,
      cost_breakdown: row.cost_vector || {},
      fairness_metrics: row.fairness_snapshot || {},
      status: row.status,
      assigned_at: row.created_at,
      review_submitted: !!row.review_id,
      review_created_at: row.review_created_at,
      suggestion_adopted: row.suggestion_adopted
    }));

    await audit(client, user_id, 'VIEW_ASSIGNMENTS', 'submission', submission_id, {
      count: assignees.length,
      include_canceled: include_canceled === 'true'
    });

    return {
      submission_id,
      assignees,
      total_count: assignees.length,
      active_count: assignees.filter((a: any) => a.status === 'pending').length,
      completed_count: assignees.filter((a: any) => a.status === 'completed').length
    };
  });

  res.json(result);
}));

router.get('/v1/by-reviewer/:id', asyncHandler(async (req, res) => {
  const { user_id, role } = (req as any).user;
  const { id: reviewer_id } = req.params;
  const { status, limit = '50', offset = '0' } = req.query;

  if (role !== 'instructor' && role !== 'admin' && user_id !== reviewer_id) {
    res.status(403).json({ error: 'forbidden', detail: 'Cannot view other reviewers assignments' });
    return;
  }

  const result = await withDb(user_id, role, async (client) => {
    const statusFilter = status ? 'AND a.status = $3' : '';
    const query = `
      SELECT 
        a.assignment_id,
        a.submission_id,
        a.strategy,
        a.score,
        a.cost_vector,
        a.fairness_snapshot,
        a.status,
        a.created_at,
        s.title AS submission_title,
        s.created_at AS submission_created_at,
        s.user_id AS submitter_id,
        su.netid AS submitter_netid,
        r.review_id,
        r.created_at AS review_created_at
      FROM assignments a
      LEFT JOIN submissions s ON s.submission_id = a.submission_id
      LEFT JOIN users su ON su.user_id = s.user_id
      LEFT JOIN reviews r ON r.submission_id = a.submission_id AND r.reviewer_id = a.reviewer_id
      WHERE a.reviewer_id = $1
        ${statusFilter}
      ORDER BY a.created_at DESC
      LIMIT $2 OFFSET ${status ? '$4' : '$3'}
    `;

    const params = status 
      ? [reviewer_id, limit, status, offset]
      : [reviewer_id, limit, offset];

    const { rows } = await client.query(query, params);

    const countQuery = `
      SELECT COUNT(*) as total
      FROM assignments a
      WHERE a.reviewer_id = $1 ${statusFilter}
    `;
    const countParams = status ? [reviewer_id, status] : [reviewer_id];
    const { rows: [{ total }] } = await client.query(countQuery, countParams);

    const assignments = rows.map((row: any) => ({
      assignment_id: row.assignment_id,
      submission_id: row.submission_id,
      submission_title: row.submission_title,
      submission_created_at: row.submission_created_at,
      submitter_id: row.submitter_id,
      submitter_netid: row.submitter_netid,
      strategy: row.strategy,
      score: row.score ? parseFloat(row.score) : null,
      cost_breakdown: row.cost_vector || {},
      fairness_metrics: row.fairness_snapshot || {},
      status: row.status,
      assigned_at: row.created_at,
      review_submitted: !!row.review_id,
      review_created_at: row.review_created_at
    }));

    await audit(client, user_id, 'VIEW_REVIEWER_ASSIGNMENTS', 'user', reviewer_id, {
      count: assignments.length,
      status_filter: status || 'all'
    });

    return {
      reviewer_id,
      assignments,
      pagination: {
        total: parseInt(total),
        limit: parseInt(limit as string),
        offset: parseInt(offset as string),
        has_more: parseInt(offset as string) + assignments.length < parseInt(total)
      }
    };
  });

  res.json(result);
}));

router.get('/v1/explain/:assignment_id', asyncHandler(async (req, res) => {
  const { user_id, role } = (req as any).user;
  const { assignment_id } = req.params;

  const result = await withDb(user_id, role, async (client) => {
    const query = `
      SELECT 
        a.assignment_id,
        a.submission_id,
        a.reviewer_id,
        a.strategy,
        a.score,
        a.cost_vector,
        a.fairness_snapshot,
        a.status,
        a.created_at,
        s.title AS submission_title,
        s.user_id AS submitter_id,
        su.netid AS submitter_netid,
        su.group_id AS submitter_group,
        u.netid AS reviewer_netid,
        u.group_id AS reviewer_group,
        r.review_id
      FROM assignments a
      LEFT JOIN submissions s ON s.submission_id = a.submission_id
      LEFT JOIN users su ON su.user_id = s.user_id
      LEFT JOIN users u ON u.user_id = a.reviewer_id
      LEFT JOIN reviews r ON r.submission_id = a.submission_id AND r.reviewer_id = a.reviewer_id
      WHERE a.assignment_id = $1
    `;

    const { rows } = await client.query(query, [assignment_id]);

    if (rows.length === 0) {
      return { error: 'not_found', detail: 'Assignment not found or unauthorized' };
    }

    const row = rows[0];
    const cost_vector = row.cost_vector || {};
    const fairness = row.fairness_snapshot || {};

    let alternatives = [];
    if (role === 'instructor' || role === 'admin') {
      const altQuery = `
        SELECT 
          a.assignment_id,
          a.reviewer_id,
          a.score,
          a.cost_vector,
          a.status,
          u.netid AS reviewer_netid
        FROM assignments a
        LEFT JOIN users u ON u.user_id = a.reviewer_id
        WHERE a.submission_id = $1 
          AND a.assignment_id <> $2
        ORDER BY a.score ASC NULLS LAST
        LIMIT 5
      `;
      
      const { rows: altRows } = await client.query(altQuery, [row.submission_id, assignment_id]);
      alternatives = altRows.map((alt: any) => ({
        assignment_id: alt.assignment_id,
        reviewer_id: alt.reviewer_id,
        reviewer_netid: alt.reviewer_netid,
        score: alt.score ? parseFloat(alt.score) : null,
        delta_score: (alt.score && row.score) ? parseFloat(alt.score) - parseFloat(row.score) : null,
        cost_breakdown: alt.cost_vector || {},
        status: alt.status
      }));
    }

    const explanation = generateExplanation(row.strategy, cost_vector, fairness);

    await audit(client, user_id, 'EXPLAIN_ASSIGNMENT', 'assignment', assignment_id, {
      strategy: row.strategy,
      viewer_role: role
    });

    return {
      assignment_id: row.assignment_id,
      submission_id: row.submission_id,
      submission_title: row.submission_title,
      submitter: {
        user_id: row.submitter_id,
        netid: row.submitter_netid,
        group_id: row.submitter_group
      },
      reviewer: {
        user_id: row.reviewer_id,
        netid: row.reviewer_netid,
        group_id: row.reviewer_group
      },
      assignment: {
        strategy: row.strategy,
        score: row.score ? parseFloat(row.score) : null,
        status: row.status,
        assigned_at: row.created_at,
        review_submitted: !!row.review_id
      },
      cost_breakdown: {
        workload: cost_vector.workload !== undefined ? parseFloat(cost_vector.workload) : null,
        diversity: cost_vector.diversity !== undefined ? parseFloat(cost_vector.diversity) : null,
        conflict: cost_vector.conflict !== undefined ? parseFloat(cost_vector.conflict) : null,
        total: cost_vector.total !== undefined ? parseFloat(cost_vector.total) : null,
        ...cost_vector
      },
      fairness_metrics: {
        tpr_gap: fairness.tpr_gap !== undefined ? parseFloat(fairness.tpr_gap) : null,
        fpr_gap: fairness.fpr_gap !== undefined ? parseFloat(fairness.fpr_gap) : null,
        demographic_parity: fairness.demographic_parity !== undefined ? parseFloat(fairness.demographic_parity) : null,
        ...fairness
      },
      explanation,
      alternatives: alternatives.length > 0 ? alternatives : undefined
    };
  });

  if (result.error) {
    res.status(404).json(result);
    return;
  }

  res.json(result);
}));

function generateExplanation(strategy: string, cost_vector: any, fairness: any): any {
  const explanations: any = {
    objective: '',
    why_this_pair: '',
    key_factors: []
  };

  switch (strategy) {
    case 'hungarian':
      explanations.objective = 'Minimize total cost using Hungarian algorithm (optimal bipartite matching)';
      explanations.why_this_pair = 'This pairing achieves the lowest feasible total cost under constraints';
      break;
    case 'ilp':
      explanations.objective = 'Minimize cost using Integer Linear Programming with fairness constraints';
      explanations.why_this_pair = 'Optimal solution balancing cost and fairness constraints';
      break;
    case 'ppo':
      explanations.objective = 'Reinforcement learning (PPO) optimizing long-term fairness and efficiency';
      explanations.why_this_pair = 'Policy learned from historical data to balance immediate and future outcomes';
      break;
    case 'manual':
      explanations.objective = 'Manual assignment by instructor';
      explanations.why_this_pair = 'Assigned based on instructor judgment';
      break;
    default:
      explanations.objective = 'Assignment strategy: ' + (strategy || 'unknown');
      explanations.why_this_pair = 'Assignment made according to configured strategy';
  }

  // Add key factors
  if (cost_vector.workload !== undefined) {
    const workload = parseFloat(cost_vector.workload);
    if (workload < 0.3) {
      explanations.key_factors.push({ factor: 'workload', impact: 'low', note: 'Reviewer has light current workload' });
    } else if (workload > 0.7) {
      explanations.key_factors.push({ factor: 'workload', impact: 'high', note: 'Reviewer has heavy workload - may need rebalancing' });
    }
  }

  if (cost_vector.diversity !== undefined) {
    const diversity = parseFloat(cost_vector.diversity);
    if (diversity < 0.3) {
      explanations.key_factors.push({ factor: 'diversity', impact: 'good', note: 'High reviewer diversity for this submission' });
    }
  }

  if (cost_vector.conflict !== undefined) {
    const conflict = parseFloat(cost_vector.conflict);
    if (conflict > 0.5) {
      explanations.key_factors.push({ factor: 'conflict', impact: 'warning', note: 'Potential conflict of interest detected' });
    }
  }

  if (fairness.tpr_gap !== undefined) {
    const tpr_gap = parseFloat(fairness.tpr_gap);
    if (tpr_gap > 0.1) {
      explanations.key_factors.push({ factor: 'fairness_tpr', impact: 'concern', note: 'TPR gap exceeds threshold, monitoring needed' });
    }
  }

  return explanations;
}

export default router;
